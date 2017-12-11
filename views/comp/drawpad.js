/**
 * Created by toyota on 2016/11/22.
 * 
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
        mixins: [mmjVueMdlMixin],           // update_mdl();
        el: function () {
            return '.drawpad';
        },
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
                selectTypes: {}

            }
        },
        props: ['ctrid', 'width', 'height'],
        ready: function() {
            var self = this;
            var $el = $(this.$el);
            this.sketchpad = new $.Sketchpad({
                element: $el.find('.canvas-box'),
                layerCount: 2,
                initialLayer: 1,
                width: this.width || 400,
                height: this.height || 300,
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
            //this.sketchpad.color=this.color;

            // $(this.$el).find('input[type=color]').on('change', function(){
            //    //console.log(this);
            //     self.penStyle.backgroundColor=self.sketchpad.color=this.value;
            // });
            $(this.$el).mmjDropTarget({
                dropped: function(files) {
                    self.setBgImage(files);
                }
            });
            
        },

        methods: {
            undo: function() {
                this.sketchpad.undo();
            },
            
            redo: function() {
                this.sketchpad.redo();
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
                        self.sketchpad.addImage(reader.result, layer);
                    };
                    reader.readAsDataURL(file);
                }
            },
            
            insertImage: function(e) {
                this.setImage(e.target.files, this.layer=='fg' ? 1 : 0);
            },

            deleteItems: function() {
                this.sketchpad.deleteSelectedObjects();
            },

            reselect: function() {
                if(this.state == 'selecting') {
                    this.sketchpad.completeSelection();
                } else {
                    this.sketchpad.restartSelection(true);
                }
            },
            deselect: function() {
                if(this.state == 'deselecting') {
                    this.sketchpad.completeSelection();
                } else {
                    this.sketchpad.restartSelection(false);
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
                    this.sketchpad.applyPenSizeToSelection(true);
                }
            },

            toImage: function(completed, layers) {
                this.sketchpad.toImage(completed, layers);
            },
            snapshot: function(completed, layers) {
                this.sketchpad.toCanvas(completed, layers);
            },
            paste: function(type, data, layer) {
                this.sketchpad.paste(type, data, layer);
            },
            
            copy: function() {
                return this.sketchpad.getSelectionAsJson();
            },
            
            cut: function() {
                var r = this.copy();
                if(r) {
                    this.sketchpad.deleteSelectedObjects();
                }
                return r;
            }
        },
        
        watch: {
            'penSize': function(v) {
                this.sketchpad.penSize = v;
                if(this.state=='selected' && this.selectTypes.stroke) {
                    this.sketchpad.applyPenSizeToSelection(false);
                }

                if(v<4) {
                    v = 4;
                }
                this.penStyle.height = this.penStyle.width=v+'px';
                this.penStyle.borderRadius = v/2+'px';
            },
            'color': function(v) {
                this.sketchpad.color = v;
                if(this.state=='selected' && (this.selectTypes.stroke||this.selectTypes.text)) {
                    this.sketchpad.applyColorToSelection(true);
                }
                this.updatePenSampleColor(v);
            },
            'mode': function(v) {
                this.sketchpad.setMode((v=='image')?'draw':v);
                if(v=='erase') {
                    this.updatePenSampleColor('#ffffff');
                } else {
                    this.updatePenSampleColor(this.color);
                }
            },
            'layer' : function(v) {
                switch(v) {
                    case 'bg':
                        this.sketchpad.activateLayer([1,0], 0);
                        break;
                    case 'fg':
                        this.sketchpad.activateLayer([0,1], 1);
                        break;
                    default:
                        this.sketchpad.activateLayer([1,1], 1);
                        break;
                }
            }
        }
    });

})();