/**
 * MDL用DOMツリー更新メソッド（各vueインスタンスにmixinして使用）
 * Created by toyota on 2016/07/29.
 */
'use strict';

window.mch = window.mch || {};
mch.eventBus = new Vue();

(function(){

    mch.vueMdlMixin = {
        methods: {
            upgrade_mdl: function () {
                this.$nextTick(function () {
                    componentHandler.upgradeElements(this.$el);
                    if (this.onUpgradeMdl) {
                        this.onUpgradeMdl();
                    }
                });
            },
        }
    };

    /**
     * fade トランジッションの完了タイミングをトリガーする
     * 
     * Fade-In/Outが完了したときに、mch.eventBusに対して、fade-transition-completed イベントを発行する。
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
