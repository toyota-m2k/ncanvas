/**
 * demo.js
 *
 * nCanvas and DrawPad Demo
 * 
 * - all feature of DrawPad
 * - composing Animation-GIF
 *   ... using Kevin Kwok's library (https://github.com/antimatter15/jsgif)
 * 
 * Created by toyota on 2016/11/22.
 * Copyright 2016-2017 M.TOYOTA
 * All rights reserved.
 */
'use strict';

(function ($) {
    'use strict';

    function encode64(input) {
        var output = "", i = 0, l = input.length,
            key = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
            chr1, chr2, chr3, enc1, enc2, enc3, enc4;
        while (i < l) {
            chr1 = input.charCodeAt(i++);
            chr2 = input.charCodeAt(i++);
            chr3 = input.charCodeAt(i++);
            enc1 = chr1 >> 2;
            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            enc4 = chr3 & 63;
            if (isNaN(chr2)) enc3 = enc4 = 64;
            else if (isNaN(chr3)) enc4 = 64;
            output = output + key.charAt(enc1) + key.charAt(enc2) + key.charAt(enc3) + key.charAt(enc4);
        }
        return output;
    }

    var vueRoot = new Vue({
        mixins: [window.mch.vueMdlMixin],           // update_mdl();
        el: '#vueRoot',
        data: {
            frames: [],
            repeat: 0,
            initialDelay: 500,
            delay: 500,
            state: 'first'
        },
        ready: function() {
            var self = this;
            window.mch.clipboard.enable();
            window.mch.clipboard.register('drawpad', {
                paste: function(event) {
                    if(window.mch.clipboard.getImageData(event, function(image) {
                            self.$refs['drawpad'].paste('image', image);
                        })) {
                        return true;
                    }
                    var text = window.mch.clipboard.getTextData(event, 'text/plain');
                    if(text) {
                        self.$refs['drawpad'].paste('text', text);
                        return true;
                    }
                    
                    text = window.mch.clipboard.getTextData(event, 'text/x-mch-draw');
                    if(text) {
                        self.$refs['drawpad'].paste('stroke', text);
                        return true;
                    }
                    return false;
                },
                
                copy: function() {
                    var d = self.$refs['drawpad'].copy();
                    return d ? {type:'text/x-mch-draw', value:d} : null;
                },
                cut: function(complete) {
                    var d = self.$refs['drawpad'].cut();
                    return d ? {type:'text/x-mch-draw', value:d} : null;
                }
            });
        },
        beforeDestroy: function() {
            window.mch.clipboard.unregister('drawpad');
        },
        methods: {
            toggleState: function() {
                if(!this.encoder) {
                    // Animation GIF のリピート数がちょっと特殊なので、小細工。
                    //
                    // this.repeat
                    //    visual loop count on view
                    //        --> internal repeat count of GIFs
                    //
                    //      ∞ --> 0 (infinite)
                    //      1 --> -1 (play once, no repeat)
                    //      2 --> 1 (play twice == play once and repeat once more)
                    //      3 --> 2 (play three times == play once and repeat twice)
                    //      ...
                    var repeat = 0;                 // repeat infinite
                    if(this.repeat==1) {
                        repeat = -1;                // play once
                    } else if(this.repeat>1) {
                        repeat = this.repeat-1;     // play <this.repeat> times
                    }

                    this.encoder = new GIFEncoder();
                    this.encoder.setSize(this.$refs['drawpad'].canvasSize.width, this.$refs['drawpad'].canvasSize.height);
                    this.encoder.setRepeat(repeat);
                    this.encoder.setDelay(this.initialDelay);
                    this.encoder.start();
                    this.frames = [];
                    this.state = 'composing';
                } else {
                    this.frames = [];
                    this.encoder = null;
                    this.state = 'first';
                }
            },
            addFrame: function() {
                if(this.encoder) {
                this.$refs['drawpad'].snapshot(function(canvas){
                        // this.encoder.addFrame(canvas.getContext('2d'), this.delay);
                        this.frames.push({
                            data: canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,
                            url: canvas.toDataURL(),
                            delay: this.delay
                        });
                }.bind(this));
                }
            },
            removeFrame: function() {
                if(this.encoder && this.frames.length>0) {
                    this.frames.pop();
                }
            },
            complete: function() {
                if(this.encoder) {
                    for(var i=0, ci=this.frames.length ; i<ci ; i++) {
                        this.encoder.addFrame(this.frames[i].data, this.frames[i].delay);
                    }
                    this.encoder.finish();
                    var binary_gif = this.encoder.stream().getData();
                    var src = 'data:image/gif;base64,'+encode64(binary_gif);
                    this.frames = [{url:src}];
                    this.encoder = null;
                    this.state = 'first';
                }
            },
        },
        computed: {
            images: function() {
                return this.frames.map(function(obj){
                    return obj.url;
                });
            }
        }
    });

})(jQuery);