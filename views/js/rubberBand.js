/**
 * RubberBand
 *
 * Usege
 *
 *  // 初期化
 *  var rb = new RubberBand($container);
 *
 *  // ラバーバンドの位置・サイズを指定
 *  rb.setRect(rect);
 *
 *  // ラバーバンドの縦横比を指定（optional: keepAspect(true)の場合のみ使用）
 *  rb.setAspect(width/height)
 *
 *  // ラバーバンドの移動可能範囲を指定（optional, but recommended)
 *  rb.setBoundary(rect)
 *
 *  // ラバーバンド移動・リサイズ中のコールバック
 *  rb.onmoving = function(rb) {
 *      // moving or resizing from rb.orgRect to rb.rect.
 *      // callback frequently while dragging.
 *
 *  };
 *  // ラバーバンド移動・リサイズ完了時のコールバック
 *  rb.onmoved = function(rb) {
 *      // moved or resized from  rb.orgRect to rb.rect.
 *      // callback once.
 *  };
 *
 *  // ラバーバンドを表示
 *  rb.show();
 *
 *  // ラバーバンドを非表示化
 *  rb.hide();
 *
 *  // ラバーバンドは表示中？
 *  if(rb.isShown()) {
 *      ...
 *  }
 *
 *
 *  // 縦横比を維持するかどうかを指定
 *  //  flag == "keepCurrent"       現在のrectの比率を維持
 *  //          "keepSetting",      setAspect()で指定された比率を維持
 *  //          "free"              維持しない
 *  keepAspect(flag);
 *
 * Created by toyota on 2016/11/28.
 * Copyright 2016 M.TOYOTA
 * All rights reserved.
 */
(function($) {
    'use strict';

    // 移動リサイズ操作
    function Transformer(from, to, margin) {
        if(from && to) {
            this.set(from, to, margin);
        } else if(from) {
            this.copyFrom(from);
        }
    }
    Transformer.prototype._len = function(l) {
        return l || 1;
    };
    Transformer.prototype._ratio = function(t,f) {
        return this._len(t)/this._len(f);
    };
    Transformer.prototype.set = function(from, to, margin) {
        margin = margin || 0;
        this.org = {
            x: from.left+margin/2,
            y: from.top+margin/2
        };
        this.translate = {
            x: to.left - from.left,
            y: to.top - from.top
        };
        this.ratio = {
            x: this._ratio(to.width()-margin, from.width()-margin),
            y: this._ratio(to.height()-margin, from.height()-margin)
        };
        return this;
    };

    Transformer.prototype.copyFrom = function(s) {
        this.org = {x:s.org.x, y:s.org.y};
        this.translate = {x:s.translate.x, y:s.translate.y};
        this.ratio = {x:s.ratio.x, y:s.ratio.y};
        return this;
    };


    Transformer.prototype.x = function(x) {
        return (x-this.org.x)*this.ratio.x + this.org.x + this.translate.x;
    };
    Transformer.prototype.y = function(y) {
        return (y-this.org.y)*this.ratio.y + this.org.y + this.translate.y;
    };
    Transformer.prototype.rect = function(r) {
        r.left = this.x(r.left);
        r.right = this.x(r.right);
        r.top = this.y(r.top);
        r.bottom = this.y(r.bottom);
        return r;
    };
    Transformer.prototype.point = function(p) {
        p.x = this.x(p.x);
        p.y = this.y(p.y);
        return p;
    };

    function Point(x, y) {
        this.x = x || 0;
        this.y = y || 0;
    }


    function Rect(left, top, right, bottom) {
        if (typeof left === 'object') {
            this.copyFrom(left);
        } else {
            this.left = left || 0;
            this.top = top || 0;
            this.right = (null==right) ? this.left : right;
            this.bottom = (null==bottom) ? this.top : bottom;
            this.normalize();
        }
    }

    Rect.prototype.ix = function() {
        return Math.round(this.left);
    };
    Rect.prototype.iy = function() {
        return Math.round(this.top);
    };
    Rect.prototype.ih = function() {
        return Math.round(this.height());
    };
    Rect.prototype.iw = function() {
        return Math.round(this.width());
    };
    
    Rect.prototype.clone = function() {
        return new Rect(this);
    };

    Rect.prototype.set = function (left, top, right, bottom) {
        this.left = left || 0;
        this.top = top || 0;
        this.right = (null==right) ? this.left : right;
        this.bottom = (null==bottom) ? this.top : bottom;
        this.normalize();
        return this;
    };

    Rect.prototype.copyFrom = function (src) {
        this.left = src.left;
        this.top = src.top;
        this.bottom = src.bottom;
        this.right = src.right;
    };

    Rect.prototype.setLeftTop = function (x, y) {
        this.left = x;
        this.top = y;
        return this;
    };

    Rect.prototype.setRightTop = function (x, y) {
        this.right = x;
        this.top = y;
        return this;
    };

    Rect.prototype.setLeftBottom = function (x, y) {
        this.left = x;
        this.bottom = y;
        return this;
    };

    Rect.prototype.setRightBottom = function (x, y) {
        this.right = x;
        this.bottom = y;
        return this;
    };

    Rect.prototype.moveTop = function(y) {
        var dy = y - this.top;
        this.top = y;
        this.bottom += dy;
        return this;
    };
    Rect.prototype.moveLeft = function (x) {
        var dx = x - this.left;
        this.left = x;
        this.right += dx;
        return this;
    };
    Rect.prototype.moveBottom = function(y) {
        var dy = y - this.bottom;
        this.bottom = y;
        this.top += dy;
        return this;
    };
    Rect.prototype.moveRight = function(x) {
        var dx = x - this.right;
        this.right = x;
        this.left += dx;
        return this;
    };

    Rect.prototype.moveLeftTop = function (x, y) {
        this.moveLeft(x).moveTop(y);
        return this;
    };
    Rect.prototype.moveRightBottom = function (x, y) {
        this.moveRight(x).moveBottom(y);
        return this;
    };

    Rect.prototype.newPoint = function(x,y) {
        this.left = this.right = x;
        this.top = this.bottom = y;
        return this;
    };
        
    Rect.prototype.addPoint = function(x,y) {
        if(x<this.left) {
            this.left = x;
        } else if(x>this.right) {
            this.right = x;
        }
        if(y<this.top) {
            this.top = y;
        } else if(y>this.bottom) {
            this.bottom = y;
        }
        return this;
    };
    
    Rect.prototype.inflate = function(v) {
        this.left-=v;
        this.right+=v;
        this.top-=v;
        this.bottom+=v;
        return this;
    };
    
    Rect.prototype.hitTest = function(point) {
        return this.left<point.x && point.x<this.right
            && this.top<point.y && point.y<this.bottom;
    };

    Rect.prototype._lineIntersect = function(ax, ay, bx, by, cx, cy, dx, dy) {
        var ta = (cx - dx) * (ay - cy) + (cy - dy) * (cx - ax);
        var tb = (cx - dx) * (by - cy) + (cy - dy) * (cx - bx);
        var tc = (ax - bx) * (cy - ay) + (ay - by) * (ax - cx);
        var td = (ax - bx) * (dy - ay) + (ay - by) * (ax - dx);
        return tc * td < 0 && ta * tb < 0;
    };

    Rect.prototype.intersectTest = function(p1, p2) {
        return this.hitTest(p1) 
            || this.hitTest(p2)
            || this._lineIntersect(this.left, this.top, this.right, this.bottom, p1.x, p1.y, p2.x, p2.y)
            || this._lineIntersect(this.left, this.bottom, this.right, this.top, p1.x, p1.y, p2.x, p2.y);
    };
    
    Rect.prototype.unionRect = function(r) {
        if(this.left>r.left) {
            this.left = r.left;
        }
        if(this.right<r.right) {
            this.right = r.right;
        }
        if(this.top>r.top) {
            this.top = r.top;
        }
        if(this.bottom<r.bottom) {
            this.bottom = r.bottom;
        }
    };
    
    Rect.prototype.equals = function(r) {
        return r.left == this.left 
            && r.top == this.top
            && r.right == this.right
            && r.bottom == this.bottom;
    };

    // Rect.prototype.limitTop = function (y) {
    //     return (y > this.bottom) ? this.bottom : y;
    // };
    //
    // Rect.prototype.limitBottom = function (y) {
    //     return (y < this.top) ? this.top : y;
    // };
    // Rect.prototype.limitLeft = function (x) {
    //     return (x > this.right) ? this.right : x;
    // };
    // Rect.prototype.limitRight = function (x) {
    //     return (x < this.left) ? this.left : x;
    // };
    // Rect.prototype.limitSetTop = function (y) {
    //     this.top = this.limitTop(y);
    // };
    // Rect.prototype.limitSetBottom = function (y) {
    //     this.bottom = this.limitBottom(y);
    // };
    // Rect.prototype.limitSetLeft = function (x) {
    //     this.left = this.limitLeft(x);
    // };
    // Rect.prototype.limitSetRight = function (x) {
    //     this.right = this.limitRight(x);
    // };

    Rect.prototype.normalize = function () {
        if (this.left > this.right) {
            var h = this.right;
            this.right = this.left;
            this.left = h;
        }
        if (this.top > this.bottom) {
            var v = this.bottom;
            this.bottom = this.top;
            this.top = v;
        }
        return this;
    };

    Rect.prototype.width = function () {
        return this.right - this.left;
    };

    Rect.prototype.height = function () {
        return this.bottom - this.top;
    };

    function RubberBand(root) {
        for (var key in this.constructor.prototype) {
            this[key] = this[key].bind(this);
        }

        this.box = $('<div class="rubber-bands">').css('display', 'none');
        this.l = $('<div class="rb rb-l">');
        this.t = $('<div class="rb rb-t">');
        this.r = $('<div class="rb rb-r">');
        this.b = $('<div class="rb rb-b">');
        this.lt = $('<div class="knob knob-lt">');
        this.rt = $('<div class="knob knob-rt">');
        this.lb = $('<div class="knob knob-lb">');
        this.rb = $('<div class="knob knob-rb">');
        this.ml = $('<div class="knob knob-l">');
        this.mr = $('<div class="knob knob-r">');
        this.mt = $('<div class="knob knob-t">');
        this.mb = $('<div class="knob knob-b">');
        this.c = $('<div class="rb-content">');

        root.append(this.box
                .append(this.mt)
                .append(this.ml)
                .append(this.mr)
                .append(this.mb)
                .append(this.c)
                .append(this.l)
                .append(this.t)
                .append(this.r)
                .append(this.b)
                .append(this.lt)
                .append(this.rt)
                .append(this.lb)
                .append(this.rb)
                );

        this.rect = new Rect();
        this.orgRect = new Rect();
        this.target = null;
        //this.keepAspect = false;
        this.aspect = 0;
        this.aspectSetting = 0;

        this.l[0].addEventListener('mousedown', this._mouseDown);
        this.l[0].addEventListener('touchstart', this._mouseDown);
        this.l.data('rb', {x: 'min'});

        this.r[0].addEventListener('mousedown', this._mouseDown);
        this.r[0].addEventListener('touchstart', this._mouseDown);
        this.r.data('rb', {x: 'max'});

        this.t[0].addEventListener('mousedown', this._mouseDown);
        this.t[0].addEventListener('touchstart', this._mouseDown);
        this.t.data('rb', {y: 'min'});

        this.b[0].addEventListener('mousedown', this._mouseDown);
        this.b[0].addEventListener('touchstart', this._mouseDown);
        this.b.data('rb', {y: 'max'});

        this.lt[0].addEventListener('mousedown', this._mouseDown);
        this.lt[0].addEventListener('touchstart', this._mouseDown);
        this.lt.data('rb', {x: 'min', y: 'min'});

        this.lb[0].addEventListener('mousedown', this._mouseDown);
        this.lb[0].addEventListener('touchstart', this._mouseDown);
        this.lb.data('rb', {x: 'min', y: 'max'});

        this.rt[0].addEventListener('mousedown', this._mouseDown);
        this.rt[0].addEventListener('touchstart', this._mouseDown);
        this.rt.data('rb', {x: 'max', y: 'min'});

        this.rb[0].addEventListener('mousedown', this._mouseDown);
        this.rb[0].addEventListener('touchstart', this._mouseDown);
        this.rb.data('rb', {x: 'max', y: 'max'});

        this.c[0].addEventListener('mousedown', this._mouseDown);
        this.c[0].addEventListener('touchstart', this._mouseDown);
        this.c.data('rb', {c:true});
    }

    RubberBand.prototype._mouseDown = function (event) {
        console.log('rubber band mouse down.');
        this.target = null;
        var $t = $(event.target);
        var p = $t.data('rb');
        if (!p) {
            return;
        }

        event.preventDefault();
        this.target = $t;
        this.dragging = false;

        this.touch = false;
        if (event.type === "touchstart") {
            event = event.changedTouches[0];
            this.touch = true;
        }
        this.org = {
            x: event.pageX - this.target[0].offsetLeft,
            y: event.pageY - this.target[0].offsetTop
        };
        console.log('mouse down at x=' + this.org.x + ', y=' + this.org.y);

        if (!this.touch) {
            document.body.addEventListener('mousemove', this._mouseMove, false);
            document.body.addEventListener('mouseup', this._mouseUp, false);
        } else {
            document.body.addEventListener('touchmove', this._mouseMove, false);
            document.body.addEventListener('touchend', this._mouseUp, false);
        }

        // this.target.css('background-color', 'blue');
    };

    var DRAG_THRESHOLD = 5;
    var MIN_LEDGE = 4;

    RubberBand.prototype._resizeX = function (x, hint) {
        if(!hint) {
            return x;
        }
        if(hint=='min') {
            // left
            if(x>this.rect.right-MIN_LEDGE) {
                x = this.rect.right-MIN_LEDGE;
            }
            if(this.boundary) {
                if (this.boundary && x > this.boundary.right - MIN_LEDGE) {
                    x = this.boundary.right - MIN_LEDGE;
                }
            }
            this.rect.left = x;
        } else {
            // right
            if(x<this.rect.left+MIN_LEDGE) {
                x = this.rect.left+MIN_LEDGE;
            }
            if(this.boundary) {
                if (this.boundary && x < this.boundary.left + MIN_LEDGE) {
                    x = this.boundary.left + MIN_LEDGE;
                }
            }
            this.rect.right = x;
        }
        return x;
    };

    RubberBand.prototype._resizeY = function (y, hint) {
        if(!hint) {
            return null;
        }
        if(hint=='min') {
            // top
            if(y>this.rect.bottom-MIN_LEDGE) {
                y = this.rect.bottom-MIN_LEDGE;
            }
            if(this.boundary) {
                if (this.boundary && y > this.boundary.bottom - MIN_LEDGE) {
                    y = this.boundary.bottom - MIN_LEDGE;
                }
            }
            this.rect.top = y;
        } else {
            // bottom
            if(y<this.rect.top+MIN_LEDGE) {
                y = this.rect.top+MIN_LEDGE;
            }
            if(this.boundary) {
                if (this.boundary && y < this.boundary.top + MIN_LEDGE) {
                    y = this.boundary.top + MIN_LEDGE;
                }
            }
            this.rect.bottom = y;
        }
        return y;
    };

    RubberBand.prototype._applyAspect = function(hintX, hintY) {
        if(this.aspect) {
            // knob
            var h = this.rect.height(), w = this.rect.width();
            if (hintX && hintY) {
                if(w<h) {
                    w = h* this.aspect;
                } else {
                    h = w/this.aspect;
                }
                if(hintX=='min') {
                    // left
                    this.rect.left = this.rect.right - w;
                    if(this.boundary) {
                        if (this.rect.left > this.boundary.right - MIN_LEDGE) {
                            this.rect.moveLeft(this.boundary.right - MIN_LEDGE)
                        }
                    }
                } else {
                    this.rect.right = this.rect.left + w;
                    if(this.boundary) {
                        if (this.rect.right < this.boundary.left + MIN_LEDGE) {
                            this.rect.moveRight(this.boundary.left + MIN_LEDGE)
                        }
                    }
                }

                if(hintY=='min') {
                    // left
                    this.rect.top = this.rect.bottom - h;
                    if(this.boundary) {
                        if (this.rect.top > this.boundary.bottom - MIN_LEDGE) {
                            this.rect.moveTop(this.boundary.bottom - MIN_LEDGE)
                        }
                    }
                } else {
                    this.rect.bottom = this.rect.top + w;
                    if(this.boundary) {
                        if (this.rect.bottom < this.boundary.top + MIN_LEDGE) {
                            this.rect.moveBottom(this.boundary.top + MIN_LEDGE)
                        }
                    }
                }
            } else if (hintX) {
                // left/right
                h = w / this.aspect;
                this.rect.bottom = this.rect.top + h;
                if(this.boundary) {
                    if (this.rect.bottom < this.boundary.top + MIN_LEDGE) {
                        this.rect.moveBottom(this.boundary.top+MIN_LEDGE);
                    }
                }
            } else if (hintY) {
                // top/bottom
                w = h * this.aspect;
                this.rect.right = this.rect.left + w;
                if(this.boundary) {
                    if (this.rect.right < this.boundary.left + MIN_LEDGE) {
                        this.rect.moveRight(this.boundary.left+MIN_LEDGE);
                    }
                }
            }
        }
    };

    RubberBand.prototype._moveContent = function(x,y) {
        this.rect.moveLeftTop(x,y);
        if(this.boundary) {
            if (this.rect.right < this.boundary.left+MIN_LEDGE) {
                this.rect.moveRight(this.boundary.left+MIN_LEDGE);
            } else if (this.rect.left > this.boundary.right-MIN_LEDGE) {
                this.rect.moveLeft(this.boundary.right-MIN_LEDGE);
            }
            if (this.rect.bottom < this.boundary.top+MIN_LEDGE) {
                this.rect.moveBottom(this.boundary.top+MIN_LEDGE);
            } else if (this.rect.top > this.boundary.bottom-MIN_LEDGE) {
                this.rect.moveTop(this.boundary.bottom-MIN_LEDGE);
            }
        }
    };

    RubberBand.prototype._mouseMove = function (event) {
        if (this.target) {
            event.preventDefault();
            if (event.type === "touchmove") {
                event = event.changedTouches[0];
            }

            var p = this.target.data('rb');
            var x = event.pageX - this.org.x;
            var y = event.pageY - this.org.y;

            if(p.x||p.y) {
                // resizing
                this._resizeX(x, p.x);
                this._resizeY(y, p.y);
                this._applyAspect(p.x, p.y);
            } else {
                // moving
                if(!this.dragging) {
                    if(Math.abs(x- this.target[0].offsetLeft)<DRAG_THRESHOLD && Math.abs(y-this.target[0].offsetTop)<DRAG_THRESHOLD) {
                        return;
                    } else {
                        this.dragging = true;
                    }
                }
                this._moveContent(x,y);
            }

            
            // this.target[0].style.top =  x + "px";
            // this.target[0].style.left = y + "px";
            this.updatePosition();
            if(this.onmoving) {
                this.onmoving(this);
            }
            console.log('mouse moving at x=' + x + ', y=' + y);
        }
    };

    RubberBand.prototype._mouseUp = function (event) {
        event.preventDefault();
        console.log('mouse up or canceled');
        if(!this.touch) {
            document.body.removeEventListener('mousemove', this._mouseMove);
            document.body.removeEventListener('mouseup', this._mouseUp);
        } else {
            document.body.removeEventListener('touchmove', this._mouseMove);
            document.body.removeEventListener('touchend', this._mouseUp);
        }

        var p = this.target.data('rb');
        this.target = null;
        if(p.c && !this.dragging) {
            console.log('mouse clicked inside rubber band.');
            if(this.onclicked) {
                this.onclicked(this, event);
            }
        } else {
            console.log('mouse moved.');
            if(this.onmoved) {
                this.onmoved(this);
            }
        }

        // this.target.css('background-color', 'red');
        // document.body.removeEventListener('mouseout', this._mouseUp);

    };


    RubberBand.prototype.show = function () {
        this.box.css('display', 'block');
    };
    RubberBand.prototype.hide = function () {
        this.box.css('display', 'none');
    };
    RubberBand.prototype.isShown = function() {
        return this.box.css('display') != 'none';
    };

    RubberBand.prototype.setRect = function (rect) {
        if (this.rect) {
            this.rect.copyFrom(rect);
            this.orgRect.copyFrom(rect);
            this.updatePosition();
        }
    };

    // aspect = width/height;
    RubberBand.prototype.setAspect = function (aspect) {
        this.aspectSetting = aspect;
    };

    RubberBand.prototype.keepAspect = function(flag) {
        switch(flag) {
            case 'keepSetting':
                if(this.aspectSetting) {
                    this.aspect = this.aspectSetting;
                    this._applyAspect('max', 'max');
                    break;
                }
                // fall through ...
            case 'keepCurrent':
                if(this.rect.width() && this.rect.height()) {
                    this.aspect = this.rect.width() / this.rect.height();
                    this._applyAspect('max', 'max');
                    break;
                }
                // fall through ...
            case 'free':
                this.aspect = 0;
                break;
            default:
                break;
        }
        return this.aspect;
    };

    RubberBand.prototype.setBoundary = function (x,y,width, height) {
        this.boundary = new Rect(x,y,x+width,y+height);
    };

    RubberBand.prototype.updatePosition = function () {
        if (this.rect) {
            var margin = 4;
            var top = this.rect.top - margin;
            var left = this.rect.left - margin;
            var width = this.rect.width() + margin*2;
            var height = this.rect.height() + margin*2;
            var right = left + width;
            var bottom = top + height;

            this.c.css('left', left).css('top', top).css('width', width).css('height', height);

            this.l.css('left', left).css('top', top).css('height', height);
            this.r.css('left', right).css('top', top).css('height', height);
            this.t.css('left', left).css('top', top).css('width', width);
            this.b.css('left', left).css('top', bottom).css('width', width);

            this.lt.css('left', left).css('top', top);
            this.rt.css('left', right).css('top', top);
            this.lb.css('left', left).css('top', bottom);
            this.rb.css('left', right).css('top', bottom);

            var mv = (top+bottom)/2;
            var mh = (left+right)/2;
            this.ml.css('left', left).css('top', mv);
            this.mr.css('left', right).css('top', mv);
            this.mt.css('left', mh).css('top', top);
            this.mb.css('left', mh).css('top', bottom);
        }
    };

    window.mch = window.mch || {};
    mch.rb = {
        Point: Point,
        Rect: Rect,
        RubberBand: RubberBand,
        Transformer: Transformer
    };

})(jQuery);