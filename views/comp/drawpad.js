/**
 * drawpad.js
 * 
 * DrawPad demo compornent using nCanvas
 * 
 * - 2-layered drawing canvas.
 * - supports multi object types (Pen/Eraser/Text/Picture)
 * - all objects are selectable and editable, i.e. movable, resizable removable.
 * - undo/redo unlimitedly
 * 
 * Created by toyota on 2016/11/22.
 * Copyright 2016 M.TOYOTA
 * All rights reserved.
 */
(function() {
    'use strict';

    var rgbex = /#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i;
    var toRgb = function(s) {
        var v = s.match(rgbex);
        return v.length==4 ? {r:parseInt(v[1],16), g:parseInt(v[2], 16), b:parseInt(v[3],16)} : null;
    };

    Vue.component('drawpad', {
        mixins: [mch.vueMdlMixin],           // update_mdl();
        // el: function () {
        //     return '.drawpad';
        // },
        template: '#drawpad-template',
        data: function() {
            return {
                mode: 'draw',
                state: '',
                layer: 'all',
                canUndo: false,
                canRedo: false,
                penSize: 5,
                color: '#000000',
                penStyle: {
                    width: '5px',
                    height: '5px',
                    borderRadius: '2.5px',
                    backgroundColor: '#000000'
                    //transform: 'scale(0.208,0.208)'
                },
                penBoxStyle: {
                    color: '#000000',
                    backgroundColor: '#ffffff'
                },
                selectTypes: {},
                canvasSize: {
                    width: 640,
                    height: 400
                }

            }
        },
        props: ['ctrid', 'width', 'height'],
        mounted: function() {
            this.$nextTick(function(){
                var self = this;
                var $el = $(this.$el);
                this.canvasSize = { 
                    width: this.width || this.canvasSize.width,
                    height: this.height || this.canvasSize.height
                };
                this.drawpad = new mch.nCanvas({
                    element: $el.find('.canvas-box'),
                    layerCount: 2,
                    initialLayer: 1,
                    width: this.canvasSize.width,
                    height: this.canvasSize.height,
                    manualCompleteSelection: true,
                    on: {
                        canRedo: function(f) {
                            self.canRedo = f;
                            if(!f) {
                                self.hideTooltip(this.ctrid + 'btn-redo');
                            }
                        },
                        canUndo: function(f) {
                            self.canUndo = f;
                            if(!f) {
                                self.hideTooltip(this.ctrid + 'btn-undo');
                            }
                        },
                        modeChanged: function(v) {
                        },
                        stateChanged: function(v, types) {
                            self.state = v;
                            self.selectTypes = types || {};
                        }
                    }
                });
                //this.drawpad.color=this.color;

                // $(this.$el).find('input[type=color]').on('change', function(){
                //    //console.log(this);
                //     self.penStyle.backgroundColor=self.drawpad.color=this.value;
                // });
                $(this.$el).mchDropTarget({
                    dropped: function(files) {
                        self.setImage(files, self.layer=='fg' ? 1 : 0);
                    }
                });
            });
        },

        methods: {
            undo: function() {
                this.drawpad.undo();
            },
            
            redo: function() {
                this.drawpad.redo();
            },

            updatePenSampleColor: function(v) {
                this.penStyle.backgroundColor = v;
                this.penBoxStyle.color = v;
                this.penBoxStyle.backgroundColor = '#ffffff';
                var rgb = toRgb(v);
                if(rgb) {
                    if(rgb.r+rgb.g+rgb.b > 509) {
                        this.penBoxStyle.backgroundColor = '#505050';
                    }
                }
            },

            setImage: function(files, layer) {
                var file;
                if (files.length > 0) {
                    file = files[0];
                }

                if (file && file.type.match('image.*')) {
                    var reader = new FileReader();

                    var self = this;
                    reader.onload = function () {
                        self.drawpad.addImage(reader.result, layer);
                    };
                    reader.readAsDataURL(file);
                }
            },
            
            insertImage: function(e) {
                this.setImage(e.target.files, this.layer=='fg' ? 1 : 0);
            },

            deleteItems: function() {
                this.drawpad.deleteSelectedObjects();
            },

            reselect: function() {
                if(this.state == 'selecting') {
                    this.drawpad.completeSelection();
                } else {
                    this.drawpad.restartSelection(true);
                }
            },
            deselect: function() {
                if(this.state == 'deselecting') {
                    this.drawpad.completeSelection();
                } else {
                    this.drawpad.restartSelection(false);
                }
            },
            /**
             * ボタンがグレーアウト(disabled=true)すると、MDLツールチップが表示されたまま残るので、明示的に非表示化する。
             *
             * @param fid       ツールチップのforで指定されたID
             */
            hideTooltip: function(fid) {
                this.$nextTick(function() {
                    $(this.$el).find('.mdl-tooltip[for=' + fid + ']').removeClass('is-active');
                });
            },

            penSizeChanged: function() {
                if(this.state=='selected' && this.selectTypes.stroke) {
                    this.drawpad.applyPenSizeToSelection(true);
                }
            },

            getImageAndOpenPage: function() {
                this.toImage(function(dataUrl){
                    window.open(dataUrl);
                }, null);
            },

            toImage: function(completed, layers) {
                this.drawpad.toImage(completed, layers);
            },
            snapshot: function(completed, layers) {
                this.drawpad.toCanvas(completed, layers);
            },
            paste: function(type, data, layer) {
                this.drawpad.paste(type, data, layer);
            },
            
            copy: function() {
                return this.drawpad.getSelectionAsJson();
            },
            
            cut: function() {
                var r = this.copy();
                if(r) {
                    this.drawpad.deleteSelectedObjects();
                }
                return r;
            }
        },
        
        watch: {
            'penSize': function(v) {
                this.drawpad.penSize = v;
                if(this.state=='selected' && this.selectTypes.stroke) {
                    this.drawpad.applyPenSizeToSelection(false);
                }

                if(v<4) {
                    v = 4;
                }
                this.penStyle.height = this.penStyle.width=v+'px';
                this.penStyle.borderRadius = v/2+'px';
            },
            'color': function(v) {
                this.drawpad.color = v;
                if(this.state=='selected' && (this.selectTypes.stroke||this.selectTypes.text)) {
                    this.drawpad.applyColorToSelection(true);
                }
                this.updatePenSampleColor(v);
            },
            'mode': function(v) {
                this.drawpad.setMode((v=='image')?'draw':v);
                if(v=='erase') {
                    this.updatePenSampleColor('#ffffff');
                } else {
                    this.updatePenSampleColor(this.color);
                }
            },
            'layer' : function(v) {
                switch(v) {
                    case 'bg':
                        this.drawpad.activateLayer([1,0], 0);
                        break;
                    case 'fg':
                        this.drawpad.activateLayer([0,1], 1);
                        break;
                    default:
                        this.drawpad.activateLayer([1,1], 1);
                        break;
                }
            }
        }
    });

})();