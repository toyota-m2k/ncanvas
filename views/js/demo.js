/**
 * Created by toyota on 2016/11/22.
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
        mixins: [mmjVueMdlMixin],           // update_mdl();
        el: '#vueRoot',
        data: {
            images: [],
            repeat: 0,
            delay: 500,
            state: 'first'
        },
        ready: function() {
            var self = this;
            $.mmjClipboard.register('drawpad', {
                paste: function(event) {
                    if($.mmjClipboard.getImageData(event, function(image) {
                            self.$refs['drawpad'].paste('image', image);
                        })) {
                        return true;
                    }
                    var text = $.mmjClipboard.getTextData(event, 'text/plain');
                    if(text) {
                        self.$refs['drawpad'].paste('text', text);
                        return true;
                    }
                    
                    text = $.mmjClipboard.getTextData(event, 'text/x-mmj-draw');
                    if(text) {
                        self.$refs['drawpad'].paste('stroke', text);
                        return true;
                    }
                    return false;
                },
                
                copy: function() {
                    var d = self.$refs['drawpad'].copy();
                    return d ? {type:'text/x-mmj-draw', value:d} : null;
                },
                cut: function(complete) {
                    var d = self.$refs['drawpad'].cut();
                    return d ? {type:'text/x-mmj-draw', value:d} : null;
                }
            });
        },
        beforeDestroy: function() {
            $.mmjClipboard.unregister('drawpad');
        },
        methods: {
            snapshot: function() {
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
                    this.encoder.setRepeat(repeat);
                    this.encoder.setDelay(this.delay);
                    this.encoder.start();
                    this.images = [];
                    this.state = 'composing';
                }
                this.$refs['drawpad'].snapshot(function(canvas){
                    this.encoder.addFrame(canvas.getContext('2d'), this.delay);
                    this.images.push(canvas.toDataURL());
                }.bind(this));
            },
            complete: function() {
                if(this.encoder) {
                    this.encoder.finish();
                    var binary_gif = this.encoder.stream().getData();
                    var src = 'data:image/gif;base64,'+encode64(binary_gif);
                    this.images = [src];
                    this.encoder = null;
                    this.state = 'first';
                }
            },
            reset: function() {
                this.images = [];
                this.encoder = null;
                this.state = 'first';
            }
        }
    });

})(jQuery);