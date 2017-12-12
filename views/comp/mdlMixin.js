/**
 * MDL用DOMツリー更新メソッド（各vueインスタンスにmixinして使用）
 * Created by toyota on 2016/07/29.
 * Copyright 2016-2017 M.TOYOTA
 * All rights reserved.
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

})();
