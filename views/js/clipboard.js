/**
 * mmjClipboard.js
 * 
 * Created by toyota on 2016/12/15.
 * Copyright 2016-2017 M.TOYOTA
 * All rights reserved.
 */

(function ($) {

    class Clipboard {
        constructor() {
            this.clients = {};
            this._onPasteBinded = this._onPaste.bind(this);
            this._onCopyBinded = this._onCopy.bind(this);
            this._onCutBinded = this._onCut.bind(this);
            this.enabled = false;
        }
        register(key, options) {
            this.clients[key] = options;
        }
        unregister(key) {
            delete this.clients[key];
        }
        enable() {
            document.addEventListener('paste', this._onPasteBinded);
            document.addEventListener('copy', this._onCopyBinded);
            document.addEventListener('cut', this._onCutBinded);
        }
        disable() {
            document.removeEventListener('paste', this._onPasteBinded);
            document.removeEventListener('copy', this._onCopyBinded);
            document.removeEventListener('cut', this._onCutBinded);
        }

        getImageData(event, fnGetResult) {
            var items = event.clipboardData.items;
            var text = false, html = false;
            for (var i = 0, ci = items.length; i < ci; i++) {
                var item = items[i];
                if (item.kind == 'file' && item.type.startsWith('image/')) {
                    var imageFile = item.getAsFile();
                    var fr = new FileReader();
                    fr.onload = function (e) {
                        fnGetResult(e.target.result);
                    };
                    fr.readAsDataURL(imageFile);
                    return true;
                }
            }
            return false;
        }

        getTextData(event, type) {
            type = type || 'text/plain';
            return event.clipboardData.getData(type);
        }

        _onPaste(event) {
            var keys = Object.keys(this.clients);
            if(keys&&keys.length>0) {
                for (var i = 0, ci = keys.length; i < ci; i++) {
                    var client = this.clients[keys[i]];
                    if(client.paste(event)) {
                        event.preventDefault();
                        return;
                    }
                }
            }
        }

        _copy(event, action) {
            var keys = Object.keys(this.clients);
            if(keys&&keys.length>0) {
                for(var i=0, ci=keys.length ; i<ci ; i++) {
                    var client = this.clients[keys[i]];
                    if(client[action]) {
                        var data = client[action]();
                        if (data) {
                            event.clipboardData.setData(data.type, data.value);
                            event.preventDefault();
                        }
                    }
                }
            }
        }
        _onCopy(event) {
            console.log('onCopy');
            this._copy(event, 'copy');
        }

        _onCut(event) {
            console.log('onCut');
            this._copy(event, 'cut');
        }
    }
    
    window.mch = window.mch || {};
    window.mch.clipboard = new Clipboard;
    
})(jQuery);
