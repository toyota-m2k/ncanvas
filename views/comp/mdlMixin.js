/**
 * MDL用DOMツリー更新メソッド（各vueインスタンスにmixinして使用）
 * Created by toyota on 2016/07/29.
 */
'use strict';

var mmjVueMdlMixin;
var mmjEventBus = new Vue();

(function(){

    var urlregex = /(https?|ftp)(:\/\/[-_.!~*\'()a-zA-Z0-9;\/?:¥@&=+\$,%#]+)/g;

    mmjVueMdlMixin = {
        methods: {
            upgrade_mdl: function () {
                this.$nextTick(function () {
                    componentHandler.upgradeElements(this.$el);
                    if (this.onUpgradeMdl) {
                        this.onUpgradeMdl();
                    }
                });
            },
            formatContent: function (tx) {
                tx = tx.replace(/[>]/g, '&gt;');
                tx = tx.replace(/[<]/g, '&lt;');
                tx = tx.replace(/\r?\n/g, '<br>');
                return tx;
            },
            formatShortDate: function (d) {
                moment.locale(navigator.language);
                return moment(d).fromNow();
                // var now = moment();
                // var dat = moment(d);
                // var dy = now.diff(dat, 'years');
                // if(dy) {
                //     if(dy==1) {
                //         return 'Last year';
                //     } else {
                //         return dy + ' years ago'
                //     }
                // }
                // var dm = now.diff(dat, 'months');
                // if(dm) {
                //     if(dm==1) {
                //         return 'Last month';
                //     } else {
                //         return dm + ' months ago';
                //     }
                // }
                // var dd = now.diff(dat, 'days');
                // if(dd) {
                //     if(dd==1) {
                //         return 'Yesterday'
                //     } else {
                //         return dd + ' days ago'
                //     }
                // }
                // return dat.format('LT');
            },

            formatShortDate2: function (d) {
                moment.locale(navigator.language);
                var now = moment();
                var dat = moment(d);
                var fmt = 'LT';
                if (now.diff(dat, 'days') == 0) {
                    // today
                    return dat.format('LT');
                } else if (now.diff(dat, 'months') > 1) {
                    return dat.fromNow();
                } else {
                    return dat.format('ll');
                }
            },

            formatDate: function (d) {
                moment.locale(navigator.language);
                var c = new moment(d);
                return c.format('ll') + '<br>' + c.format('LTS');
            },

            formatLongDate: function (d, dayfmt, timefmt) {
                timefmt = timefmt || 'LTS';
                dayfmt = dayfmt || 'll';
                moment.locale(navigator.language);
                var c = new moment(d);

                var r = '';
                if (dayfmt != '-') {
                    r = c.format(dayfmt) + ' ';
                }
                if (timefmt != '-') {
                    r += c.format(timefmt);
                }
                return r;
            },

            i18nstring: function (key, val) {
                var f = mmjI18NDic ? (mmjI18NDic[key] || key ) : key;
                if (val) {
                    f = $.mmj.format(f, val);
                }
                return f;
            },

            makeUserIconUrl: function (params) {
                return $.mmj.format('/user/icon/{companyid}/{userid}.png', params);
            },

            extractLinks: function(text) {
                return text.match(urlregex);
            },

            unfurlLinks: function(text, messageid) {
                var links = text.match(urlregex);
                if(links && links.length>0) {
                    $.mmjws.sendRequest('C_UnfurlLinks', {links: links, messageid: messageid});
                }
            },

            attachmentsComparator: function(a,b) {
                var r = (a.sort || 0) - (b.sort||0);
                if(r) {
                    return r;
                }
                return a.attachmentid - b.attachmentid;
            },
            
            addAndSortAttachments: function(list, obj) {
                list.push(obj);
                list.sort(this.attachmentsComparator);
                return list;
            },

            /**
             * Unicodeの絵文字を :name: 形式の文字列に変換（そうしないとDBがエラーになる）
             * @param v
             * @returns {*}
             */
            emoji2text: function(v) {
                if($.mmj.config.EMOJI) {
                    return emojione.toShort(v);
                } else {
                    return v;
                }
            }
        }
    };


    Vue.filter('scrapelink', function(v){
        return v.replace(urlregex,function(m){
            return $.mmj.format('<a href="{url}">{url}</a>', {url:m});
        });
    });

    Vue.filter('text2html', function(v){
        return v.replace(/[&]/g, '&amp;')
                .replace(/[>]/g, '&gt;')
                .replace(/[<]/g, '&lt;')
                .replace(/[ ]/g, '&ensp;')
                .replace(/\t/g, '&emsp;&emsp;')
                .replace(/\r|\n|\r\n/g, '<br>');
    });

    Vue.filter('emoji2image', function(v){
        if($.mmj.config.EMOJI) {
            return emojione.toImage(v);
        } else {
            return v;
        }
    });

    /**
     * fade トランジッションの完了タイミングをトリガーする
     * 
     * Fade-In/Outが完了したときに、mmjEventBusに対して、fade-transition-completed イベントを発行する。
     *  @params el  トランジッションが発生した（transition=fade が設定された）エレメント
     *  @params bool true: Fade-In / false: Fade-Out
     */
    Vue.transition('fade', {
        afterEnter: function(el) {
            mmjEventBus.$emit('fade-transition-completed', el, true);       // Fade-In した（非表示-->表示に状態変化した）
        },
        afterLeave: function(el) {
            mmjEventBus.$emit('fade-transition-completed', el, false);      // Fade-Out した（表示-->非表示に状態変化した）
        }
    });
})();
