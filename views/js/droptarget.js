/**
 * droptarget.js
 * 
 * Usage:
 * 
 * - 初期化
 *      ターゲット(divなど）でのドロップを受け付け、ファイルがドロップされたら、droppedコールバックを呼び出す。
 *      var $target =$('div.someDropTarget'); 
 *      $target.mchDropTarget({
 *          dropped: function(files, event){},      // required
 *          dragenter: function(event){},           // optional
 *          dragleave: function(event){},           // optional
 *          enabled: true / false                   // optional(default:true) true: 初期状態でドロップ有効 / false:無効
 *      });
 *
 * - isEnabled
 *      ドロップの受付中か？
 * - enable     
 *      ドロップの受付を有効化
 * - disable
 *      ドロップの受付を無効化
 *      
 * Created by toyota on 2016/10/12.
 * Copyright 2016 M.TOYOTA
 * All rights reserved.
 *
 */

(function ($) {
    'use strict';

    var methods = {
        init: function (options) {
            if (options) {
                this.data('dropped', options.dropped);
                this.data('dragenter', options.dragenter);
                this.data('dragleave', options.dragleave);
                if(options.enable!=null) {
                    this.data('disabled', !options.enable);
                }
            }

            var self = this;
            var holdupEvent = function(event) {
                event.preventDefault();
                event.stopPropagation();
                return false;
            };
            // this.bind("dragenter", holdupEvent);
            this.bind("dragover", holdupEvent);

            var droppedHandler = function(event) {
                holdupEvent(event);
                var dropped = self.data('dropped');
                if(dropped) {
                    dropped(event.originalEvent.dataTransfer.files, event, self);
                }
                return false;
            };
            var dragEnterHandler = function(event) {
                holdupEvent(event);
                var dragenter = self.data('dragenter');
                if(dragenter) {
                    dragenter(event);
                }
            };
            var dragLeaveHandler = function(event) {
                holdupEvent(event);
                var dragleave = self.data('dragleave');
                if(dragleave) {
                    dragleave(event);
                }
            };
            
            this.data('droppedHandler', droppedHandler);
            this.data('dragEnterHandler', dragEnterHandler);
            this.data('dragLeaveHandler', dragLeaveHandler);

            if(!this.data('disabled')) {
                this.bind("drop", droppedHandler);
                this.bind("dragenter", dragEnterHandler);
                this.bind("dragleave", dragLeaveHandler);
            }
            return this;
        },

        isEnabled: function() {
            return !this.data('disabled');
        },

        disable: function() {
            if(!this.data('disabled')) {
                this.data('disabled', true);
                this.unbind("drop", this.data('droppedHandler'));
                this.unbind("dragenter", this.data('dragEnterHandler'));
                this.unbind("dragleave", this.data('dragLeaveHandler'));
            }
            return this;
        },

        enable: function() {
            if(this.data('disabled')) {
                this.data('disabled', false);
                this.bind("drop", this.data('droppedHandler'));
                this.bind("dragenter", this.data('dragEnterHandler'));
                this.bind("dragleave", this.data('dragLeaveHandler'));
            }
            return this;
        },

        dropped: function(callback) {
            this.data('dropped', callback);
            return this;
        },
        dragenter: function(callback) {
            this.data('dragenter', callback);
            return this;
        },
        dragleave: function(callback) {
            this.data('dragleave', callback);
            return this;
        }
    };

    $.fn.mchDropTarget = function(method) {
        if ( methods[method] ) {
            return methods[method].apply( this, Array.prototype.slice.call( arguments, 1 ));
        } else if ( typeof method === 'object' || ! method ) {
            return methods.init.apply( this, arguments );
        } else {
            $.error( 'Method ' +  method + ' does not exist on jQuery.mchDropTarget' );
        }
    };

})(jQuery);
