//  mmjSketchpad.js
//
//    Copyright (C) 2016  M.TOYOTA  All rights reserved.
//
//    sketchpad.js (https://github.com/yiom/sketchpad : MIT License)をベースに
//    若干手を加える程度のつもりだったが、
//    ・消しゴムを追加
//    ・レイヤーを追加
//    ・画像を貼る機能を追加
//    ・メソッド名、プロパティ名を適切なものに変更
//    ・undoの管理を完全に書き直し
//    ・ラバーバンドによる選択・リサイズを追加
//    ・マウス・タッチイベントのハンドリングを書き直し
//    ・animate/toObject/toJSON メソッドは削除
//    と、このあたりまできたら、もう原型をとどめないので、コピーライト表記は不要だと思っていたが、さらに、
//    ・レイヤーを選択して画像化
//    ・テキストボックス
//    ・ストローク/テキストボックスの属性（色/サイズ）変更
//    などを追加するに至り、完全にオリジナルな実装となったので、自分のコピーライトを入れることにする。
//

(function($) {

  // 外部参照
  var RubberBand = $.mmjrb.RubberBand;
  var Rect = $.mmjrb.Rect;
  var Point = $.mmjrb.Point;
  var Transformer = $.mmjrb.Transformer;
  var TEXTBOX_INIT_WIDTH = 200;
  var TEXTBOX_INIT_HEIGHT = 24;
  var TEXTBOX_MAX_WIDTH = 300;
  var TEXTBOX_MAX_HEIGHT = 250;

  /**
   * Sketchpadクラス
   * @param config
   *          element: キャンバスのコンテナ(div)
   *          layerCount: レイヤー数
   *          initialLayer: 初期状態で選択されている（描画対象となる）レイヤー番号(0 - )
   *          readOnly: true: リードオンリー
   *          width: キャンバスの幅(px)
   *          height: キャンバスの高さ(px)
   *          color: 初期ペンカラー
   *          penSize: 初期ペンサイズ
   *          on {
   *            canUndo: undo可能かどうかが変化したときのコールバック
   *            canRedo: redo可能かどうかが変化したときのコールバック
   *            modeChanged: モード(draw/erase/select)が変更されたときのコールバック
   *          }
   *
   * @constructor
   */
  function Sketchpad(config) {
    // Enforces the context for all functions
    for (var key in this.constructor.prototype) {
      this[key] = this[key].bind(this);
    }

    // Warn the user if no DOM element was selected
    if (!config.hasOwnProperty('element')) {
      console.error('SKETCHPAD ERROR: No element selected');
      return;
    }

    if (typeof(config.element) === 'string') {
      this.root = $(config.element);
    } else {
      this.root = config.element;
    }

    var layerCount = (config.layerCount || 1)+1;    // + overlay layer
    this.layers = [];
    this._activeLayers = [];
    for (var i = 0; i < layerCount; i++) {
      var c = $('<canvas class="mmj-sk-canvas">');
      this.root.append(c);
      this.layers.push({element: c});
      this._activeLayers.push(true);
    }
    this._overlay = layerCount-1;
    // this.layers[this._overlay].element[0].addEventListener('paste', function(event){
    //   console.log('paste event received.');
    // },false);

    this.eventTarget = this.layers[this._overlay].element[0];
    this.readOnly = config.readOnly || this.root.attr('data-readOnly') || false;
    if (!this.readOnly) {
      $(this.eventTarget).css({cursor: 'crosshair'});
    }

    this.elText = $('<textarea class="mmj-text-unit">');
    this.root.append(this.elText);

    this.rb = new RubberBand(this.root);
    this.rb.onmoving = this._onRubberBandMoving;
    this.rb.onmoved = this._onRubberBandMoved;
    this.rb.onclicked = this._onRubberBandClicked;

    // Width can be defined on the HTML or programatically
    this._width = config.width || this.root.attr('data-width') || 0;
    this._height = config.height || this.root.attr('data-height') || 0;

    // Pen attributes
    this.color = config.color || this.root.attr('data-color') || '#000000';
    this.penSize = config.penSize || this.root.attr('data-penSize') || 5;
    this.erase = false;   // true: eraser / false:pen    appended on 2016.11.22 by M.TOYOTA
    this.currentLayer = config.initialLayer || 0;
    this.on = config.on || {};

    // ReadOnly sketchpads may not be modified

    // Stroke control variables
    this.drawables = config.drawables || [];
    this._currentStroke = {
      type: 'stroke',
      alive: true,
      color: null,
      size: null,
      erase: false,
      layer: 0,
      rect: null,
      lines: []
    };

    this._selection = null;
    this._mode = 'draw';     // draw / select
    this._state = '';       // selecting, selected,

    //
    // Table. Combination of Mode & State
    //
    // mode         state         transition trigger      description
    // ------------ ------------- ----------------------- --------------------------------------------------------------
    // draw         ''            setMode(draw)           通常のペン描画モード
    //              selected      addImage()              image挿入中のラバーバンド表示
    // erase        ''            setMode(erase)          消しゴムモード
    // select       ''            setMode(select)         選択待ち（mousedownで選択開始、ドラッグで追加選択、mouseupで選択確定）
    //              selected      [multiple]              選択完了（１つ以上のオブジェクトを選択している）
    //              selecting     restartSelection(false) 再選択中（タップで追加選択：completeSelection呼び出しまで状態維持）
    //              deselecting   restartSelection(true)  選択解除中（タップで選択解除：completeSelection呼び出しまで状態維持）
    //

    this._transformer = new Transformer();    // working transformer

    // Undo History
    this.undoHistory = config.undoHistory || [];
    this.curHistory = config.curHistory || 0;

    // Animation function calls
    // this.animateIds = [];

    // Set sketching state
    this._sketching = false;

    // Setup canvas sketching listeners
    this._initCanvas();
  }

  /**
   * Sketchpad用に追加されたDOM要素を削除する
   */
  Sketchpad.prototype.destroy = function() {
    this.root.empty();

    // これ以降の操作をエラーにするため、主要なメンバーをクリアしておく
    delete this.layers;
    delete this.drawables;
    delete this.undoHistory;
    delete this._currentStroke;
  };

  //
  // Private API
  //

  /**
   * キャンバス廻りの初期化
   *
   * @private
   */
  Sketchpad.prototype._initCanvas = function () {
    // Set attributes
    for(var i=0 ; i<this.layers.length ; i++) {
      var layer = this.layers[i];
      layer.canvas = layer.element[0];
      layer.canvas.width = this._width;
      layer.canvas.height = this._height;
      layer.context = layer.canvas.getContext('2d');
    }

    this.root.css('width', this._width);
    this.root.css('height', this._height);
    this.rb.setBoundary(0,0,this._width, this._height);

    // Setup event listeners
    this._redraw();

    if (this.readOnly) {
      return;
    }

    // Mouse
    this.eventTarget.addEventListener('mousedown', this._mouseDown);
    // Touch
    this.eventTarget.addEventListener('touchstart', this._mouseDown);
  };


  /**
   * eventオブジェクトからマウス/タップ位置を取得する
   * @param event イベントオブジェクト
   * @returns {{x: number, y: number}}　マウス/タップ座標
   * @private
   */
  Sketchpad.prototype._cursorPosition = function (event) {
    if (event.type === 'touchstart'||event.type=='touchmove') {
      event = event.changedTouches[0];
    }
    
    return {
      x: event.pageX - $(this.eventTarget).offset().left,
      y: event.pageY - $(this.eventTarget).offset().top
    };
  };

  var IdenticalTransformer = {
    x: function(x) { return x;},
    y: function(y) { return y;}
  };

  /**
   * ストロークを直線で描画する
   *
   * @param layerInfo     描画先レイヤー
   * @param obj         描画オブジェクト
   * @private
   */
  Sketchpad.prototype._drawStrokesWithLine = function (layerInfo, obj) {
    if(!obj.points.length) {
      return;
    }

    var ctx = layerInfo.context;

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = obj.color;
    ctx.lineWidth = obj.size;
    ctx.globalCompositeOperation = obj.erase ? 'destination-out' : 'source-over';
    ctx.beginPath();

    var transformer = obj.transformer || IdenticalTransformer;
    var x, y, point;

    // 始点
    point = obj.points[0];
    x = transformer.x(point.x);
    y = transformer.y(point.y);
    ctx.moveTo(x,y);

    // 以降、順次lineTo
    if(obj.points.length==1) {
      ctx.lineTo(x,y);
    } else {
      for(var i=1, ci=obj.points.length ; i<ci ; i++) {
        point = obj.points[i];
        x = transformer.x(point.x);
        y = transformer.y(point.y);
        ctx.lineTo(x,y);
      }
    }

    ctx.stroke();
    ctx.restore();
  };

  /**
   * ストロークをベジエ曲線で描画する
   *
   * @param layerInfo     描画先レイヤー
   * @param obj         描画オブジェクト
   * @private
   */
  Sketchpad.prototype._drawStrokes = function (layerInfo, obj) {
    if(!obj.points.length) {
      return;
    }
    if(obj.points.length<3) {
      return this._drawStrokesWithLine(layerInfo, obj);
    }
    var ctx = layerInfo.context;
    var transformer = obj.transformer || IdenticalTransformer;
    var x, y, points = obj.points;

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = obj.color;
    ctx.lineWidth = obj.size;
    ctx.globalCompositeOperation = obj.erase ? 'destination-out' : 'source-over';
    ctx.beginPath();

    // 始点
    x = transformer.x(points[0].x);
    y = transformer.y(points[0].y);
    ctx.moveTo(x,y);


    for (var i = 1; i < points.length - 2; i ++) {
      var xc = transformer.x((points[i].x + points[i + 1].x) / 2);
      var yc = transformer.y((points[i].y + points[i + 1].y) / 2);
      ctx.quadraticCurveTo(transformer.x(points[i].x), transformer.y(points[i].y), xc, yc);
    }
    // curve through the last two points
    ctx.quadraticCurveTo(transformer.x(points[i].x), transformer.y(points[i].y), transformer.x(points[i+1].x),transformer.y(points[i+1].y));

    ctx.stroke();
    ctx.restore();
  };


  /**
   * ２点間の直線を描画する
   *
   * @param layerInfo     描画先レイヤー
   * @param start         lineの始点
   * @param end           lineの終点
   * @param color         色
   * @param size          線幅
   * @param erase         true: 消しゴム / false: ペン
   * @param transformer   位置・サイズ補正用オブジェクト（nullなら補正なし）
   * @private
   */
  Sketchpad.prototype._drawLine = function (layerInfo, start, end, color, size, erase, transformer) {
    var compositeOperation = erase ? 'destination-out' : 'source-over';
    var sx = start.x, sy=start.y, ex=end.x, ey=end.y;
    if(transformer) {
      sx = transformer.x(sx);
      sy = transformer.y(sy);
      ex = transformer.x(ex);
      ey = transformer.y(ey);
    }

    layerInfo.context.save();
    layerInfo.context.lineJoin = 'round';
    layerInfo.context.lineCap = 'round';
    layerInfo.context.strokeStyle = color;
    layerInfo.context.lineWidth = size;
    layerInfo.context.globalCompositeOperation = compositeOperation;
    layerInfo.context.beginPath();
    layerInfo.context.moveTo(sx, sy);
    layerInfo.context.lineTo(ex, ey);
    layerInfo.context.stroke();
    layerInfo.context.restore();

  };

  /**
   * undo/redoバッファに履歴を積む
   * 
   * @param his   履歴オブジェクト
   * @private
     */
  Sketchpad.prototype._addHistory = function(his) {
    if (this.curHistory < this.undoHistory.length) {
      // redo 情報が残っていれば削除する
      this.undoHistory.splice(this.curHistory);
      if (this.on.canRedo) {
        this.on.canRedo(false);
      }
    }

    this.undoHistory.push(his);

    this.curHistory++;
    if (this.curHistory == 1) {
      if (this.on.canUndo) {
        this.on.canUndo(true);
      }
    }
  };

  /**
   * 描画オブジェクト（線、画像）を追加する
   *
   * @param obj         描画オブジェクト
   * @returns {number}  追加されたオブジェクトのインデックス
   * @private
     */
  Sketchpad.prototype._addObject = function (obj) {
    this.drawables.push(obj);

    this._addHistory({
      obj: obj,
      act: 'add'
    });
  };

  /**
   * オブジェクトを置換して、履歴に積む
   *
   * @param orgObj
   * @param newObj
   * @private
   */
  Sketchpad.prototype._replaceObject = function (orgObj, newObj) {
    orgObj.alive = false;
    var i = this.drawables.indexOf(orgObj);
    this.drawables.splice(i, 0, newObj);

    var group = [
      {act: 'del', obj: orgObj},
      {act: 'add', obj: newObj}
    ];
    this._addHistory({act: 'group', sub: group});

  };

  /**
   * テキストボックスのサイズを計算する
   *
   * @param text    テキスト
   * @param font    使用フォント
   * @returns {{width: number, lineMargin: number, lineHeight: *, height: number, lines: Array}}
   * @private
   */
  Sketchpad.prototype._measureText = function(text, font) {
    if(!this.txMeasure) {
      this.txMeasure = $('<div>Hg</div>');
      var con = $('<div style="width:0;height:0;overflow:hidden">');
      con.append(this.txMeasure);
      this.root.append(con);
    }
    this.txMeasure.css('font', font);

    var texts = text.split(/\r|\n|\r\n/);
    var width = 0;
    var ctx = this.layers[this._overlay].context;
    ctx.save();
    ctx.font = font;
    texts.forEach(function(t){
      var m = ctx.measureText(t);
      if(width<m.width) {
        width = m.width;
      }
    }, this);
    ctx.restore();
    var lineMargin = this.txMeasure.height()*0.1;
    return {
      width: width,
      lineMargin: lineMargin,
      lineHeight: this.txMeasure.height()+lineMargin,
      height: (this.txMeasure.height()+lineMargin)*texts.length,
      lines: texts
    }
  };

  /**
   * 指定された位置にテキストボックスがあれば、それを返す。
   * @param pos   座標
   * @return 見つかったテキストボックス（描画オブジェクト）、なければnull
   * @private
   */
  Sketchpad.prototype._hitTestTextBox = function (pos) {
    for(var i=this.drawables.length-1 ; i>=0 ; i--) {
      var e = this.drawables[i];
      if (e.alive && this._activeLayers[e.layer] && e.type=='text') {
        if (e.rect.hitTest(pos)) {
          return e;
        }
      }
    }
    return null;
  };

  /**
   * テキスト編集中か？（＝編集用のTEXTAREAが表示されているか？）
   *
   * @returns {boolean}
   * @private
   */
  Sketchpad.prototype._isEditingText = function () {
    return this.elText.css('display')!='none';
  };

  /**
   * テキストボックスの編集を開始（テキスト入力欄を表示）
   *
   * @param obj   編集対象オブジェクト（新規ならnull）
   * @param pos   クリック位置
   * @private
   */
  Sketchpad.prototype._beginEditText = function (obj, pos) {
    this.editingText = obj;

    var x,y,w,h, text;
    if(obj) {
      var mt = this._measureText(obj.text, obj.font);
      x = obj.rect.left;
      y = obj.rect.top;
      w = Math.min(Math.max(obj.rect.width(), mt.width, TEXTBOX_INIT_WIDTH), TEXTBOX_MAX_WIDTH);
      h = Math.min(Math.max(obj.rect.height(), mt.height, TEXTBOX_INIT_HEIGHT), TEXTBOX_MAX_HEIGHT);
      text = obj.text;
    } else {
      x = pos.x;
      y = pos.y - TEXTBOX_INIT_HEIGHT/2;
      w = TEXTBOX_INIT_WIDTH;
      h = TEXTBOX_INIT_HEIGHT;
      text = '';
    }

    this.elText.val(text);
    this.elText.css('left', x);
    this.elText.css('top', y);
    this.elText.css('width', w);
    this.elText.css('height', h);
    this.elText.css('display', 'block');
    this.elText[0].focus();
  };

  Sketchpad.prototype._updateText = function (obj, text) {
    if(obj.text != text) {
      // 文字列が変更された
      var layer = obj.layer;
      if(text.length==0) {
        // 文字列がクリアされた --> テキストボックスを削除
        obj.alive = false;
        this._addHistory({act: 'del', obj: obj});
        obj = null; // 選択状態の復元は不要
      } else {
        // テキストが変更された
        // 更新して、選択状態を復元
        var old = this._modifyAttr(obj, {text: text});
        if(old) {
          this._addHistory({act:'attr', obj:obj, from:old, to:{text:text}});
        }
      }
      // 再描画
      this._clear(layer);
      this._redraw(layer  );
    }
    if(obj) {
      this._selection = {objects: [obj]};
      this.completeSelection();
    }
  };

  Sketchpad.prototype.addText = function (text, layer, pos) {
    layer = (null!=layer) ? layer : this.currentLayer;
    if(text.length>0) {
      if(this._mode=='select' || this._state=='selected') {
        this.resetSelection();
      }

      var font = this.elText.css('font');
      var mt = this._measureText(text, font);
      var rect = new Rect(0, 0, mt.width,mt.height);
      if(!pos) {
        var canvas = this.layers[layer].canvas;
        var x = Math.max(0,(canvas.width-mt.width)/2), y = Math.max(0,(canvas.height-mt.height)/2);
        rect.moveLeftTop(x,y);
      } else {
        rect.moveLeftTop(pos.x, pos.y);
      }

      var obj = {
        type: 'text',
        layer: layer,
        alive: true,
        text: text,
        font: font,
        color: this.color,
        sel: true,
        rect: rect
      };

      this._addObject(obj);
      this._drawObject(obj);
      this._selection = {objects: [obj]};
      this.completeSelection();
    }
  };
    /**
   * テキスト編集を終了する
   * @private
   */
  Sketchpad.prototype._endEditText = function () {
    var text = this.elText.val();
    var obj = null;
    if(this.editingText) {
      obj = this.editingText;
      delete this.editingText;
      this._updateText(obj, text);
    } else {
      if(text.length!=0) {
        // 新しいテキストボックスを作成
        var el = this.elText[0];
        this.addText(text, this.currentLayer, new Point(el.offsetLeft, el.offsetTop));
      }
    }
    this.elText.css('display', 'none');
  };
    /**
   * マウス左クリック / 画面タップ時のイベントハンドラ
   * @param event イベントオブジェクト
   * @private
   */
  Sketchpad.prototype._mouseDown = function (event) {
    event.preventDefault();
    if (this._sketching) {
      return;
    }

    // テキストモード中の処理
    if(this._mode == 'text') {
      var pos = this._cursorPosition(event);
      if(!this._isEditingText()) {
        // 未編集状態 --> 編集開始
        if(this._state!='') {
          // 選択中（ラバーバンド表示中）なら選択解除
          this.resetSelection();
        }
        this._beginEditText(this._hitTestTextBox(pos), pos);
      } else {
        // 編集中 --> 編集終了
        this._endEditText();
      }
      return;
    }

    if (this._mode != 'select' && this._state!='') {
      // 選択モードで選択中にクリックされた時は選択解除するだけ
      this.resetSelection();
      return;
    }

    // move/up イベントリスナーを登録
    if (event.type === "touchstart") {
      this.touch = true;
      this.eventTarget.addEventListener('touchmove', this._mouseMove);
      this.eventTarget.addEventListener('touchend', this._mouseUp);
      this.eventTarget.addEventListener('touchcancel', this._mouseUp);
      this.eventTarget.addEventListener('touchleave', this._mouseUp);

    } else {
      this.touch = false;
      this.eventTarget.addEventListener('mousemove', this._mouseMove);
      this.eventTarget.addEventListener('mouseout', this._mouseUp);
      this.eventTarget.addEventListener('mouseup', this._mouseUp);
    }

    this._lastPosition = this._cursorPosition(event);
    this._sketching = true;
    if (this._mode != 'select') {
      this._currentStroke.color = this.color;
      this._currentStroke.size = this.penSize;
      this._currentStroke.erase = this.erase;
      this._currentStroke.points = [$.extend(true, {}, this._lastPosition)];
      this._currentStroke.layer = this.currentLayer;
      this._currentStroke.rect = new Rect(this._lastPosition.x, this._lastPosition.y);
    } else {
      this._beginSelect(this._lastPosition, event);
    }
  };

  /**
   * マウス/タッチドラッグ時のイベントハンドラ
   *
   * @param event イベントオブジェクト
   * @private
   */
  Sketchpad.prototype._mouseMove = function (event) {
    var currentPosition = this._cursorPosition(event);
    if(currentPosition.x==this._lastPosition.x && currentPosition.y==this._lastPosition.y) {
      return;
    }
    if (this._mode != 'select') {
      var layer = (this.erase) ? this._currentStroke.layer : this._overlay;
      this._currentStroke.rect.addPoint(currentPosition.x, currentPosition.y);
      this._drawLine(this.layers[layer], this._lastPosition, currentPosition, this.color, this.penSize, this.erase);
      this._currentStroke.points.push($.extend(true, {}, currentPosition));
    } else {
      this._updateSelect(this._lastPosition, currentPosition);
    }
    this._lastPosition = currentPosition;
  };

  /**
   * マウス左ボタンリリース/タッチ終了イベントのハンドラ
   *
   * @private
   */
  Sketchpad.prototype._mouseUp = function (/*event*/) {
    if (this._sketching) {
      this._sketching = false;
      if (this._mode != 'select') {
        this._currentStroke.rect.inflate(this.penSize / 2);
        this._currentStroke.baseRect = this._currentStroke.rect.clone();
        this._currentStroke.points = this._smoothStroke(this._currentStroke.points);
        var obj = $.extend(true, {}, this._currentStroke);
        this._addObject(obj);
        if(!this.erase) {
          this._drawObject(obj);
          this._clear(this._overlay);
        } else {
          this._clear(this._currentStroke.layer);
          this._redraw(this._currentStroke.layer);
        }
      } else {
        this._endSelect();
      }
    }
    if (this.touch) {
      this.eventTarget.removeEventListener('touchmove', this._mouseMove);
      this.eventTarget.removeEventListener('touchend', this._mouseUp);
      this.eventTarget.removeEventListener('touchcancel', this._mouseUp);
      this.eventTarget.removeEventListener('touchleave', this._mouseUp);
    } else {
      this.eventTarget.removeEventListener('mousemove', this._mouseMove);
      this.eventTarget.removeEventListener('mouseout', this._mouseUp);
      this.eventTarget.removeEventListener('mouseup', this._mouseUp);
    }
  };

  /**
   * 選択操作を開始・・・mode=='select'で、クリックされたときの処理
   *
   * @param p   クリック/タッチ位置
   * @param event イベント情報
   * @private
   */
  Sketchpad.prototype._beginSelect = function (p, event) {
    // this._clear();
    // this.redraw();
    if(this._state == 'selected' && !event.ctrlKey ) {
      this.resetSelection();
    }

    if(!this._selection) {
      this._selection = {objects: [], layers:[]};
    }

    var selecting = 0; // toggle
    if (this._state == 'selecting') {
      selecting = 1;
    } else if(this._state == 'deselecting') {
      selecting = -1;
    }
    if(event.ctrlKey) {
      selecting = 0;
    }
    
    var update = false;
    for(var i=this.drawables.length-1 ; i>=0 ; i--) {
      var e = this.drawables[i];
      if(e.alive && this._activeLayers[e.layer]) {
        var hit = e.rect.hitTest(p);
        if(hit) {
          switch(selecting) {
            case 1: // select
              if(!e.sel) {
                e.sel = true;
                this._selection.objects.push(e);
                update = true;
              }
              break;
            case -1: // deselect
              if(e.sel) {
                e.sel = false;
                this._selection.objects.splice(this._selection.objects.indexOf(e),1);
                update = true;
              }
              break;
            case 0: // toggle
              e.sel = !e.sel;
              if(e.sel) {
                this._selection.objects.push(e);
              } else {
                this._selection.objects.splice(this._selection.objects.indexOf(e),1);
              }
              update = true;
              break;
          }
        }

        if(update) {
          if(this._state == 'selected') {
            // ctrl + click
            this.completeSelection();
          } else {
            this._drawSelection();
          }
          break;
        }
      }
    }
  };

  /**
   * 選択状態を更新・・・mode=='select'で、ドラッグ中の処理
   *
   * @param p1    前回のマウス/タッチ位置
   * @param p2    現在のマウス/タッチ位置
   * @private
   */
  Sketchpad.prototype._updateSelect = function (p1, p2) {
    if(this._state!='') {
      return;
    }
    var update = false;
    this.drawables.forEach(function (e) {
      if (!e.sel && e.alive && this._activeLayers[e.layer]) {
        e.sel = e.rect.intersectTest(p1, p2);
        if (e.sel) {
          update = true;
          this._selection.objects.push(e);
        }
      }
    }, this);
    if(update) {
      this._drawSelection();
    }
  };

  /**
   * 選択操作終了・・・選択オブジェクトが１つ以上存在すれば、ラバーバンドによる移動・リサイズ操作へ移行
   *
   * @private
   */
  Sketchpad.prototype._endSelect = function () {
    if(this._state=='') {
      this.completeSelection();
    }
  };

  /**
   * ラバーバンドを表示して、移動/リサイズ操作を開始
   */
  Sketchpad.prototype.completeSelection = function() {
    if(!this._selection.objects.length) {
      return;
    }

    this._state = 'selected';

    // 選択オブジェクトをすべて含む領域を計算
    var types = {};
    var r = null;
    this._selection.layers = {};
    this._selection.objects.forEach(function(e){
      if(!r) {
        r = e.rect.clone();
      } else {
        r.unionRect(e.rect);
      }
      e.orgRect = e.rect.clone();     // 各オブジェクトの初期位置を退避
      this._selection.layers[e.layer] = true;
      types[e.type] = true;
    }, this);


    this._selection.moveFrom = r;
    if(null==this._selection.lastHistory) {
      this._selection.lastHistory = this.curHistory;      // undo/redoで、ラバーバンド（選択）を解除・復元する履歴境界を保持しておく
    }

    this._drawSelection();

    this.rb.setAspect(r.width()/(r.height()||1));
    this.rb.setRect(r);
    this.rb.show();

    if(this.on.stateChanged) {
      this.on.stateChanged(this._state, types);
    }
  };

  /**
   * 選択が完了し移動・リサイズ操作が開始された（ラバーバンドが表示された）状態から、もう一度、選択操作を開始する。
   * この後は、mouseupイベントでは選択操作から抜けないので、明示的に completeSelection()を呼び出す必要がある。
   */
  Sketchpad.prototype.restartSelection = function(select) {
    if(this._state == 'selected') {
      this.rb.hide();
      this._state = select ? 'selecting' : 'deselecting';
      if (this.on.stateChanged) {
        this.on.stateChanged(this._state);
      }
    }
  };

  /**
   * ラバーバンドを消して、移動/リサイズ操作を終了
   */
  Sketchpad.prototype.resetSelection = function() {
    this._state = '';
    if(this._selection) {
      this._selection.objects.forEach(function(e) {
        delete e.sel;
        delete e.orgRect;
      });
      this._selection = null;
    }
    if(this.rb.isShown()) {
      this.rb.hide();
    }
    this._drawSelection();

    if(this.on.stateChanged) {
      this.on.stateChanged(this._state);
    }
  };

  /**
   * ラバーバンドが移動・リサイズされている（ドラッグイベントで何度も呼ばれる）
   *
   * @param rb  ラバーバンド
   * @private
   */
  Sketchpad.prototype._onRubberBandMoving = function(rb) {
    this._transformer.set(this._selection.moveFrom, rb.rect);
    this._selection.objects.forEach(function(obj){
      this._moveObject(obj, this._transformer);
    }, this);
    this._drawSelection(true);
  };

  /**
   * ラバーバンドの移動・リサイズが完了した
   *
   * @param rb
   * @private
   */
  Sketchpad.prototype._onRubberBandMoved = function(rb) {
    this._onRubberBandMoving(rb);

    var history = [];
    this._selection.objects.forEach(function(e){
      history.push({
        act: 'move',
        obj: e,
        from: e.orgRect.clone(),
        to: e.rect.clone()
      });
      e.orgRect.copyFrom(e.rect);
    });

    this._addHistory({
      act: 'group',
      sub: history
    });

    this._selection.moveFrom.copyFrom(this.rb.rect);
  };

  /**
   * ラバーバンド内部がクリックされたときのハンドラ
   *
   * @param rb        イベントが発生したラバーバンドオブジェクト
   * @param event     イベント情報
   *
   * @private
     */
  Sketchpad.prototype._onRubberBandClicked = function(rb, event) {
    if(this._mode=='text' && this._selection.objects.length==1 && this._selection.objects[0].type=='text') {
      // 選択中のテキストボックスがタップされた --> 編集開始
      var obj = this._selection.objects[0];
      this.resetSelection();
      this._beginEditText(obj);
    } else if( this._mode=='select' && this._state=='selected' && event.ctrlKey) {
      // 選択中のオブジェクトが Ctrl+クリックされた --> 選択の追加/解除
      this._beginSelect(this._cursorPosition(event), event);
    }
  };

  /**
   * 近い点を１つにまとめることで点の数を減らして、線をなめらかにする。
   *
   * @param points    点列
   * @returns {*}
     */
  Sketchpad.prototype._smoothStroke = function(points) {
    if(points.length<4) {
      return points;
    }
    var r = [points[0]];
    var p = points[1];
    var a = {x:p.x, y:p.y};
    var c = 1;
    var TH = 3; // + penSize;

    for(var i=2, ci=points.length-1 ; i<ci ; i++) {
      if(Math.abs(points[i].x-p.x)<TH && Math.abs(points[i].y-p.y)<TH) {
        a.x = (a.x*c + points[i].x)/(c+1);
        a.y = (a.y*c + points[i].y)/(c+1);
        c++;
      } else {
        r.push(a);
        p = points[i];
        a = {x:p.x, y:p.y};
        c = 1;
      }
    }

    r.push(a);
    r.push(points[ci]);
    console.log('count of points was reduced: ' + points.length + ' --> ' + r.length);
    return r;
  };


  /**
   * オブジェクトを描画する
   *
   * @param obj               描画オブジェクト
   * @param layers            レイヤーフィルター
   * @param drawToLayerInfo   描画先レイヤー情報（nullならlayerに描画）
   * @private
   */
  Sketchpad.prototype._drawObject = function (obj, layers, drawToLayerInfo) {
    if (!obj.alive) {
      return;
    }
    if(null!=layers && layers!=obj.layer && !layers[obj.layer]) {
      return;
    }
    this._drawObjectCore(obj, drawToLayerInfo);
  };

  /**
   * オブジェクト描画の中の人
   *
   * @param obj               描画オブジェクト
   * @param drawToLayerInfo   描画先レイヤー（nullなら、obj.layerに描画）
   * @private
     */
  Sketchpad.prototype._drawObjectCore = function (obj, drawToLayerInfo) {
    var layerInfo = drawToLayerInfo || this.layers[obj.layer];
    if (obj.type == 'stroke') {
      this._drawStrokes(layerInfo, obj);
    } else if (obj.type == 'image') {
      // layerInfo.context.fillStyle = "white";
      layerInfo.context.drawImage(obj.img, obj.rect.left, obj.rect.top, obj.rect.width(), obj.rect.height());
    } else if( obj.type == 'text') {
      this._drawText(layerInfo, obj);
    }
  };



  /**
   * 選択マークを描画する
   *
   * @param redrawObjects     true: 選択オブジェクトを含むレイヤー（_selection.layers）を再描画する：移動・リサイズ時の再描画
   * @private
     */
  Sketchpad.prototype._drawSelection = function (redrawObjects) {
    // overlay layerに、オブジェクト境界を描画
    this._clear(this._overlay);
    var layerInfo = this.layers[this._overlay];
    if(this._mode =='select') {
      // 画像挿入時は、
      // mode == draw, state==selected
      this.drawables.forEach(function (e) {
        this._drawSelectionRect(e, this._activeLayers, layerInfo);
      }, this);
    }

    if(redrawObjects) {
      // オブジェクトを再描画
      this._clear(this._selection.layers);
      this._redraw(this._selection.layers);
    }
  };

  /**
   * 矩形を描画
   *
   * @param layerInfo   描画先レイヤー情報
   * @param rect        矩形
   * @param color       線の色
   * @param size        線幅
   * @param compositeOperation    描画モード（デフォルト：source-over）
   * @private
   */
  // Sketchpad.prototype._rectangle = function(layerInfo, rect, color, size, compositeOperation) {
  //   layerInfo.context.save();
  //   layerInfo.context.lineJoin = 'miter';
  //   layerInfo.context.lineCap = 'square';
  //   layerInfo.context.strokeStyle = color;
  //   layerInfo.context.lineWidth = size;
  //   layerInfo.context.globalCompositeOperation = compositeOperation || 'source-over';
  //   layerInfo.context.strokeRect(rect.left, rect.top, rect.width(), rect.height());
  //   layerInfo.context.restore();
  // };

  /**
   * テキストを描画する
   * 
   * @param layerInfo   描画先レイヤー情報
   * @param obj         描画オブジェクト
   * @private
     */
  Sketchpad.prototype._drawText = function(layerInfo, obj) {
    var mt = this._measureText(obj.text, obj.font);
    var sx = obj.rect.width()/(mt.width||1);
    var sy = obj.rect.height()/(mt.height||1);
    var scale = sx<sy ? sx : sy;

    layerInfo.context.save();
    layerInfo.context.font = obj.font;
    layerInfo.context.textAlign='start';
    layerInfo.context.textBaseline = 'top';
    layerInfo.context.fillStyle = obj.color;
    layerInfo.context.scale(scale, scale);
    layerInfo.context.globalCompositeOperation = 'source-over';
    var top = obj.rect.top/scale;
    mt.lines.forEach(function(t) {
      layerInfo.context.fillText(t, obj.rect.left/scale, top /*, obj.rect.width()*/);
      top += mt.lineHeight;
    });
    layerInfo.context.restore();
  };

  /**
   * 描画オブジェクトの選択枠を描画
   *
   * @param obj               描画オブジェクト
   * @param layers            レイヤーフィルター
   * @param drawToLayerInfo   描画先レイヤー情報（nullならlayerに描画）
   * @private
   */
  Sketchpad.prototype._drawSelectionRect = function (obj, layers, drawToLayerInfo) {
    if (!obj.alive || obj.erase ) {
      return;
    }
    if(null!=layers && layers!=obj.layer && !layers[obj.layer]) {
      return;
    }

    var layerInfo = drawToLayerInfo || this.layers[obj.layer];
    layerInfo.context.save();
    layerInfo.context.lineJoin = 'miter';
    layerInfo.context.lineCap = 'square';
    layerInfo.context.globalCompositeOperation = 'source-over';

    var x = obj.rect.ix(), y = obj.rect.iy(), w=obj.rect.iw(), h=obj.rect.ih();

    if(obj.sel) {
      layerInfo.context.lineWidth = 2;
      layerInfo.context.setLineDash([5, 5]);
      layerInfo.context.strokeStyle = '#FFFFFF';
      layerInfo.context.strokeRect(x-1, y-1, w+2, h+2);
      layerInfo.context.strokeStyle = '#ef6c00';
      layerInfo.context.strokeRect(x-1, y-1, w+2, h+2);
    } else {
      layerInfo.context.translate(0.5,0.5);
      layerInfo.context.lineWidth = 1;
      layerInfo.context.strokeStyle = '#eeeeee';
      layerInfo.context.strokeRect(x,y,w,h);
      layerInfo.context.strokeStyle = '#bdbdbd';
      layerInfo.context.strokeRect(x-1, y-1, w+2, h+2);
    }
    layerInfo.context.restore();
  };

  /**
   * オブジェクトの描画位置・サイズ変更用トランスフォーマーを更新する
   * オブジェクトは、描画操作実行時点の点列(points) と、そのときの矩形領域(baseRect)を保持しており、
   * リサイズ・移動操作が行われると、矩形情報（rect）だけを更新する。
   * そして、描画時に、baseRectから、rectへの変形情報(Transformerオブジェクト）を使って座標変換を行うが、
   * 再描画のたびにTransformerを作成しなおすのは不経済なので、moveObjectのタイミングで作成してメンバー保持しておく。
   *
   * @param obj           オブジェクト
   * @private
     */
  Sketchpad.prototype._updateObjectTransform = function (obj) {
    if (obj.type == 'stroke') {
      if(obj.baseRect.equals(obj.rect)) {
        obj.transformer = null;
      } else {
        if(!obj.transformer) {
          obj.transformer = new Transformer(obj.baseRect, obj.rect, obj.size)
        } else {
          obj.transformer.set(obj.baseRect, obj.rect, obj.size);
        }
      }
    }
  };

  /**
   * オブジェクトを移動・リサイズする
   *
   * @param obj           描画オブジェクト
   * @param transformer   移動・リサイズ情報
   * @private
   */
  Sketchpad.prototype._moveObject = function (obj, transformer) {
    obj.rect.copyFrom(obj.orgRect);
    transformer.rect(obj.rect);
    this._updateObjectTransform(obj);
  };

  // Sketchpad.prototype.toObject = function () {
  //   return {
  //     width: this.draw.canvas.width,
  //     height: this.draw.canvas.height,
  //     drawables: this.drawables,
  //     undoHistory: this.undoHistory,
  //     curHistory: this.curHistory
  //   };
  // };

  // Sketchpad.prototype.toJSON = function () {
  //   return JSON.stringify(this.toObject());
  // };

  // Sketchpad.prototype.animate = function (ms, loop, loopDelay) {
  //   this._clear();
  //   var delay = ms;
  //   var callback = null;
  //   for (var i = 0; i < this.drawables.length; i++) {
  //     var stroke = this.drawables[i];
  //     for (var j = 0; j < stroke.lines.length; j++) {
  //       var line = stroke.lines[j];
  //       callback = this._drawStroke.bind(this, line.start, line.end, stroke.color, stroke.size, stroke.erase);
  //       this.animateIds.push(setTimeout(callback, delay));
  //       delay += ms;
  //     }
  //   }
  //   if (loop) {
  //     loopDelay = loopDelay || 0;
  //     callback = this.animate.bind(this, ms, loop, loopDelay);
  //     this.animateIds.push(setTimeout(callback, delay + loopDelay));
  //   }
  // };
  //
  // Sketchpad.prototype.cancelAnimation = function () {
  //   for (var i = 0; i < this.animateIds.length; i++) {
  //     clearTimeout(this.animateIds[i]);
  //   }
  // };

  //
  // Public API
  //

  /**
   * 再描画する
   *
   * @param layers        レイヤーフィルター
   * @param drawables     描画オブジェクト
   */
  Sketchpad.prototype._redraw = function (layers, drawables) {
    drawables = drawables || this.drawables;
    for (var i = 0; i < drawables.length; i++) {
      this._drawObject(drawables[i], layers);
    }
  };


  /**
   * キャンバス全体をクリアする
   * @param layers         レイヤーフィルター（nullならオーバーレイを除く全レイヤー）
   */
  Sketchpad.prototype._clear = function (layers) {
    if(null==layers) {
      this.layers.forEach(function(c, i){
        if(i!=this._overlay) {
          c.context.clearRect(0, 0, c.canvas.width, c.canvas.height);
        }
      }, this);
    } else if( typeof layers === 'object') {
      // クリアするレイヤーをマップで指定
      this.layers.forEach(function(c, i){
        if(layers[i]) {
          c.context.clearRect(0, 0, c.canvas.width, c.canvas.height);
        }
      }, this);
    } else {
      // 対象レイヤーを直接インデックスで指定
      var c = this.layers[layers];
      c.context.clearRect(0, 0, c.canvas.width, c.canvas.height);
    }
  };
  /**
   * オーバーレイも含めて、すべてのレイヤをクリア
   * @private
   */
  Sketchpad.prototype._clearAll = function () {
    this.layers.forEach(function(c){
        c.context.clearRect(0, 0, c.canvas.width, c.canvas.height);
    });
  };

  /**
   * ラバーバンド操作時に、アスペクト比を維持するかどうかを指定する
   * @param flag      keepCurrent / keepSetting / free
   * @return {bool}   設定後の aspect （freeなら0）
   */
  Sketchpad.prototype.keepAspect = function(flag) {
    return this.rb.keepAspect(flag);
  };

  /**
   * 描画オブジェクトの属性（color/size/text）を変更する
   *
   * @param obj     対象オブジェクト
   * @param attr    新しい属性
   * @returns {*}   変更前の属性（変更がなければnull）
   * @private
   */
  Sketchpad.prototype._modifyAttr = function (obj, attr) {
    var old = null;
    if(attr.color && attr.color!=obj.color && (obj.type=='stroke' || obj.type=='text')) {
      old = {color: obj.color};
      obj.color = attr.color;
    }
    if(attr.size && attr.size!=obj.size && (obj.type=='stroke')) {
      old = old || {};
      old.size = obj.size;
      obj.size = attr.size;

      obj.baseRect.inflate((obj.size - old.size)/2);
      obj.rect.inflate((obj.size - old.size)/2);
    }
    if(attr.text && attr.text!=obj.text && (obj.type=='text')) {
      old = old || {};
      old.text = obj.text;
      obj.text = attr.text;
    }
    return old;
  };
  /**
   * undo処理の中の人
   *
   * @param his
   * @returns {boolean}   true: レイヤーの再描画が必要 / false:対象オブジェクトだけを再描画
   * @private
   */
  Sketchpad.prototype._applyUndoCore = function (his) {
    var obj = his.obj;
    switch (his.act) {
      case 'add':
        obj.alive = false;
        return true;
      case 'del':
        obj.alive = true;
        return false;
      case 'move':
        obj.rect.copyFrom(his.from);
        this._updateObjectTransform(obj);
        return true;
      case 'attr':    // color, penSize, text
        this._modifyAttr(obj, his.from);
        return true;
      default:
        return false;
    }
  };

  /**
   * redoの中の人
   *
   * @param his
   * @returns {boolean}   true: レイヤーの再描画が必要 / false:対象オブジェクトだけを再描画
   * @private
   */
  Sketchpad.prototype._applyRedoCore = function(his) {
    var obj = his.obj;
    switch (his.act) {
      case 'del':
        obj.alive = false;
        return true;
      case 'add':
        obj.alive = true;
        return false;
      case 'move':
        obj.rect.copyFrom(his.to);
        this._updateObjectTransform(obj);
        return true;
      case 'attr':    // color, penSize, text
        this._modifyAttr(obj, his.to);
        return true;
      default:
        return false;
    }
  };

  /**
   * グループ化された履歴を反映する
   * @param groupedHistries   グループ化された履歴オブジェクト
   * @param fn                履歴適用関数（_applyRedoCore/_applyUndoCore)
   * @private
   */
  Sketchpad.prototype._applyGroupedHistory = function(groupedHistries, fn) {
    var needsRedraw = [];
    for(var i=groupedHistries.length-1 ; i>=0 ; i--) {
      var his = groupedHistries[i];
      if(fn(his)) {
        if(!needsRedraw[his.obj.layer]) {
          needsRedraw[his.obj.layer] = true;
          this._clear(his.obj.layer)
        }
      } else {
        if(!needsRedraw[his.obj.layer]) {
          this._drawObject(his.obj);
        }
      }
    }
    this._redraw(needsRedraw);
  };

  /**
   * Undo
   */
  Sketchpad.prototype.undo = function () {
    if (this.curHistory == 0) {
      return;
    }
    this.curHistory--;
    var his = this.undoHistory[this.curHistory];
    if(his.act!='group') {
      if(this._applyUndoCore(his)) {
        this._clear(his.obj.layer);
        this._redraw(his.obj.layer);
      } else {
        this._drawObject(his.obj);
      }
    } else {
      this._applyGroupedHistory(his.sub, this._applyUndoCore);
    }

    if (this.on.canRedo && this.curHistory == this.undoHistory.length - 1) {
      this.on.canRedo(true);
    }
    if (this.on.canUndo && this.curHistory == 0) {
      this.on.canUndo(false);
    }

    if(this._mode == 'select') {
      this._drawSelection();
    }

    if(this._selection) {
      if (this._selection.objects && this._selection.objects.length > 0 && this.curHistory >= this._selection.lastHistory) {
        this.completeSelection();
      } else {
        this.resetSelection();
      }
    }
  };

  /**
   * Redo
   */
  Sketchpad.prototype.redo = function () {
    if (this.curHistory >= this.undoHistory.length) {
      return;
    }
    var his = this.undoHistory[this.curHistory];
    if(his.act!='group') {
      if(this._applyRedoCore(his)) {
        this._clear(his.obj.layer);
        this._redraw(his.obj.layer);
      } else {
        this._drawObject(his.obj);
      }
    } else {
      this._applyGroupedHistory(his.sub, this._applyRedoCore);
    }
    this.curHistory++;

    if (this.on.canRedo && this.curHistory == this.undoHistory.length) {
      this.on.canRedo(false);
    }
    if (this.on.canUndo && this.curHistory == 1) {
      this.on.canUndo(true);
    }

    if(this._mode == 'select') {
      this._drawSelection();
    }
    if(this._selection) {
        this.completeSelection();
    }
  };

  /**
   * 画像挿入時の初期位置（キャンバスの中央、できるだけ大きく）を取得
   *
   * @param img           Imageオブジェクト
   * @returns {Rect|*}    挿入位置
     */
  Sketchpad.prototype.getImageInitialPosition = function (img) {
    var rw = 1, rh = 1, r;
    var dw = img.width, dh = img.height;
    var width = this._width, height = this._height;
    var dx, dy;
    if (dw > width) {
      rw = width / dw;
    }
    if (dh > height) {
      rh = height / dh;
    }
    r = (rw < rh) ? rw : rh;
    if (r < 1) {
      dw = dw * r;
      dh = dh * r;
    }
    dx = (width - dw) / 2;
    dy = (height - dh) / 2;
    return new Rect(dx, dy, dx+dw, dy+dh);
  };

  function loadImage(url) {
    return new Promise(function(resolve, reject){
      var img = new Image();
      img.onload = function() {
        resolve(img);
      };
      img.onerror = function(e) {
        reject(e);
      };
      img.src = url;
    });
  }

  Sketchpad.prototype.getSelectionAsJson = function() {
    if(this._selection && this._selection.objects.length>0) {
      var r = {width: this._width, height: this._height, objects: []};
      this._selection.objects.forEach(function(e){
        if(e.alive) {
          if(e.type=='image') {
            e = $.extend(true, {}, e);
            e.url = e.img.src;
            delete e.img;
          }
          r.objects.push(e);
        }
      });
      return JSON.stringify(r);
    }
    return null;
  };

  Sketchpad.prototype._addGroupedObjects = function(objects, layer) {
    if(this._mode=='select' || this._state=='selected') {
      this.resetSelection();
    }

    layer = (null!=layer) ? layer : this.currentLayer;
    var history = [];
    var selection = [];
    var promises = [];
    objects.forEach(function(e){
      e.layer = layer;
      if(e.rect) {
        e.rect = new Rect(e.rect);
      }
      if(e.transformer) {
        e.transformer = new Transformer(e.transformer);
      }
      if(e.baseRect) {
        e.baseRect = new Rect(e.baseRect);
      }
      if(e.type=='image' && e.url) {
        promises.push(loadImage(e.url).then(function(img){
          e.img = img;
          delete e.url;
          return Promise.resolve(e);
        }));
      }
      selection.push(e);
    });

    var self = this;
    Promise.all(promises)
        .then(function(){
          if(selection.length>0) {
            selection.forEach(function (e) {
              history.push({act: 'add', obj: e});
              self.drawables.push(e);
              self._drawObject(e);
            });
            self._addHistory({act:'group', sub:history});
            self._selection = {objects: selection};
            self.completeSelection();
          }
        })
        .catch(function(){
          console.log('error on pasting objects.');
        });
  };

  Sketchpad.prototype.paste = function(type, data, layer) {
    if(type=='text') {
      this.addText(data, layer);
    } else if(type=='image') {
      this.addImage(data, layer);
    } else if(type=='stroke') {
      var obj = JSON.parse(data);
      if(obj.width == this._width && obj.height==this._height) {
        this._addGroupedObjects(obj.objects, layer);
      }
    }
  };

  /**
   * 画像（描画オブジェクト）を追加する
   *
   * @param url     画像のURL
   * @param layer   追加先レイヤー
     */
  Sketchpad.prototype.addImage = function (url, layer) {
    if(this._mode=='select' || this._state=='selected') {
      this.resetSelection();
    }

    layer = (null!=layer) ? layer : this.currentLayer;
    var self = this;
    canvas = this.layers[layer].canvas;
    var img = new Image();
    img.onload = function () {
      var obj = {
        type: 'image',
        layer: layer,
        alive: true,
        img: img,
        sel: true,
        rect: self.getImageInitialPosition(img)
      };

      self._addObject(obj);
      self._drawObject(obj);

      self._selection = {
        objects: [obj]
      };
      self.completeSelection();
    };
    img.src = url;
  };

  /**
   * レイヤーの可視状態をまとめて設定
   *
   * @param layers          対象レイヤの配列（nullなら全レイヤーが対象）
   * @param drawLayer       描画対象レイヤー（nullなら現在の設定から変更しない）
     */
  Sketchpad.prototype.activateLayer = function (layers, drawLayer) {
    this._activeLayers = [].concat(layers);
    this.layers.forEach(function(e, i){
      if(i!=this._overlay) {
        this.layers[i].element.css('display', layers[i] ? '' : 'none');
      }
    },this);
    
    if(null!=drawLayer) {
      this.currentLayer = drawLayer;
    }

    if(this._mode=='select' || this._state=='selected') {
      this.resetSelection();
    }
  };


  /**
   * 編集モードを設定する。
   *
   * @param mode      'draw' ペン描画モード
   *                  'erase' 消しゴムモード
   *                  'select' 選択モード
   */
  Sketchpad.prototype.setMode = function(mode) {
    if(this._mode != mode) {
      var orgMode = this._mode;
      this._mode = mode;
      this.elText.css('display', 'none');
      var cursor = 'crosshair';

      switch(mode) {
        case 'erase':
          this.erase = true;
          break;
        case 'draw':
          this.erase = false;
          break;
        case 'text':
          cursor = 'text';
          break;
        case 'select':
        default:
          cursor = 'default';
          this._drawSelection();
          // this._clear();
          // this.redraw();
      }
      $(this.eventTarget).css({cursor: cursor});

      if(orgMode == 'select') {
        this._clearAll();
        this._redraw();
      }
      this.resetSelection();

      if(this.on.modeChanged) {
        this.on.modeChanged(mode);
      } 
    }
  };

  /**
   * 選択オブジェクトを削除する
   */
  Sketchpad.prototype.deleteSelectedObjects = function() {
    if(this._selection && this._selection.objects.length>0) {
      var history = [];
      var redrawMap = {};
      this._selection.objects.forEach(function(e){
        e.alive = false;
        redrawMap[e.layer] = true;
        history.push({
          act: 'del',
          obj: e
        });
      });
      this._addHistory({
        act: 'group',
        sub: history
      });
      this._clear(redrawMap);
      this._redraw(redrawMap);
      this.resetSelection();
    }

  };
  
  /**
   * 指定されたレイヤーの描画結果を画像(DataUrl)として取り出す。
   *
   * @param layers      レイヤー番号|レイヤー番号の配列　（nullなら全レイヤー）
   * @param fnComplete  生成した画像を返すコールバック関数
   */
  Sketchpad.prototype.toImage = function(fnComplete, layers) {
    this.toCanvas(function(canvas){
      fnComplete(canvas ? canvas.toDataURL() : null);
    }, layers);
  };

  /**
   * 指定されたレイヤーの内容を描画したCanvasを取得する
   *
   * @param layers      レイヤー番号|レイヤー番号の配列　（nullなら全レイヤー）
   * @param fnComplete  生成した画像を返すコールバック関数
   */
  Sketchpad.prototype.toCanvas = function(fnComplete, layers) {
    var layerInfo = this.layers[this._overlay];
    layerInfo.element.css('display', 'none');   // ちらつき防止のため非表示化してから作業
    layerInfo.context.save();
    layerInfo.context.fillStyle = "white";
    layerInfo.context.fillRect(0,0,layerInfo.canvas.width,layerInfo.canvas.height);
    layerInfo.context.restore();

    this._snapshot(layerInfo, function(canvas){
      fnComplete(canvas);
      if(this._mode=='select' || this._state=='selected') {
        this._drawSelection();
      } else {
        this._clear(this._overlay);
      }
      layerInfo.element.css('display', 'block');    // 非表示にしたoverlayLayerを表示する。
    }.bind(this), layers)
  };
  /**
   * @param layerInfo   描画先レイヤー情報
   * @param layers      レイヤー番号|レイヤー番号の配列　（nullなら現在表示中のレイヤー）
   * @param fnComplete  生成した画像を保持したCanvas（layerInfoで渡したCanvas）を返す関数（失敗したらnull）
   */
  Sketchpad.prototype._snapshot = function(layerInfo, fnComplete, layers) {
    // this.setMode('draw');
    layers = (null!=layers) ?  layers : this._activeLayers;
    var layerCount = this._overlay;
    var count = 0;
    var error = false;
    var images = [];
    var loadImage = function(index, url) {
      var img = new Image();
      img.onload = function(){
        if(error) {
          return; // １レイヤーでもエラーになったら、後の処理はスキップする
        }
        images[index] = img;
        count++;
        if(count==layerCount) {
          // self.setLayersVisibility(null, false);

          images.forEach(function(e){
            layerInfo.context.drawImage(e, 0, 0, layerInfo.canvas.width, layerInfo.canvas.height);
          });

          if(fnComplete) {
            fnComplete(layerInfo.canvas);
          }
          console.log('Sketchpad -- toImage completed.');
        }
      };
      img.onerror = function() {
        error = true;
        console.log('Sketchpad -- toImage error.');
        if(fnComplete) {
          console.log('error on loading images.');
          fnComplete(null, 'error on loading images.');
        }
      };
      img.src = url;
    };

    if(typeof(layers) == 'number') {
       if(fnComplete) {
         fnComplete(this.layers[layers].canvas);
       }
    } else {
      var urls = [];
      for (var i = 0, ci = this._overlay; i < ci; i++) {
        if (null == layers || layers == i || layers[i]) {
          urls.push(this.layers[i].canvas.toDataURL());
        }
      }
      layerCount = urls.length;
      if(layerCount>0) {
        urls.forEach(function(url, i) {
          loadImage(i, url);
        });
      } else {
        console.log('no active layers.');
        fnComplete(null, 'no active layers.');
      }
    }
  };

  /**
   * 描画結果をオブジェクトとして取り出す。
   * 取り出した情報は、configとしてコンストラクタに渡すことで、描画内容が復元される。
   *
   * @param slim    true: undo履歴をクリアして有効なデータだけを取り出す
   *                false: undo履歴も併せて取り出す。
   *
   * @returns {{layerCount: number, width: (number|*), height: (number|*)}}
   *
   */
  Sketchpad.prototype.toObject = function(slim) {
    var r = {
      layerCount: this.layers.length-1,
      width: this._width,
      height: this._height
    };

    if(slim) {
      var d = [];
      this.drawables.forEach(function(e){
        if(e.alive) {
          d.push(e);
        }
      });
      r.drawables = d;
    } else {
      r.drawables = this.drawables;
      r.undoHistory = this.undoHistory;
      r.curHistory = this.curHistory;
    }
    return r;
  };

  /**
   * 選択されたストロークのペンサイズを変更する
   *
   * @param complete    true: 変更を確定して履歴に積む / false:履歴には積まない
   */
  Sketchpad.prototype.applyPenSizeToSelection = function(complete) {
    var history = [], old;
    var attr = {size: this.penSize};
    var redraw = false;
    this._selection.objects.forEach(function(e){
      if(e.type=='stroke') {
        old = this._modifyAttr(e, attr);
        if(old) {
          redraw = true;
          if( !e.old ) {
            e.old = old;
          }
        }
        if(complete) {
          old = e.old;
          delete e.old;
          if(old && old.size != attr.size) {
            history.push({act: 'attr', obj: e, from: old, to: attr})
          }
        }
      }
    }, this);
    if(complete && history.length>0) {
      this._addHistory({act:'group', sub:history})
    }
    if(redraw) {
      this._clear(this._selection.layers);
      this._redraw(this._selection.layers);
    }

  };

  /**
   * 選択されたストローク・テキストの色を変更する
   *
   * @param complete    true: 変更を確定して履歴に積む / false:履歴には積まない
   */
  Sketchpad.prototype.applyColorToSelection = function(complete) {
    var history = [], old;
    var attr = {color: this.color};
    var redraw = false;
    this._selection.objects.forEach(function(e){
      if(e.type=='stroke'||e.type=='text') {
        old = this._modifyAttr(e, attr);
        if(old) {
          redraw = true;
          if( !e.old ) {
            e.old = old;
          }
        }
        if(complete) {
          old = e.old;
          delete e.old;
          if(old && old.color != attr.color) {
            history.push({act: 'attr', obj: e, from: old, to: attr})
          }
        }
      }
    }, this);
    if(complete && history.length>0) {
      this._addHistory({act:'group', sub:history})
    }
    if(redraw) {
      this._clear(this._selection.layers);
      this._redraw(this._selection.layers);
    }
  };


  $.Sketchpad = Sketchpad;

  
  
})(jQuery);