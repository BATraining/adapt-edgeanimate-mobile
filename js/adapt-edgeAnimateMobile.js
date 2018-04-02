/*
 * adapt-edgeanimate-mobile
 * Copyright (C) 2015 Bombardier Inc. (www.batraining.com)
 * https://github.com/BATraining/adapt-edgeanimate-mobile/blob/master/LICENSE
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
define(function(require) {

    var ComponentView = require('coreViews/componentView');
    var Adapt = require('coreJS/adapt');

    var EdgeAnimateMobile = ComponentView.extend({

        events: {
            'click .edgeAnimateMobile-strapline-title': 'preventDefault',
            'click .edgeAnimateMobile-popup-open': 'openPopup',
            'touchend .edgeAnimateMobile-popup-open': 'openPopup',
            'click .edgeAnimateMobile-controls': 'onNavigationClicked'
        },

        preRender: function() {
            this.listenTo(Adapt, 'device:changed', this.reRender, this);
            this.listenTo(Adapt, 'device:resize', this.resizeControl, this);
            this.listenTo(Adapt, 'notify:closed', this.closeNotify, this);
            this.setDeviceSize();

            // Checks to see if the edgeAnimateMobile should be reset on revisit
            this.checkIfResetOnRevisit();
        },

        setDeviceSize: function() {
            if (Adapt.device.screenSize === 'large') {
                this.$el.addClass('desktop').removeClass('mobile');
                this.model.set('_isDesktop', true);
            } else {
                this.$el.addClass('mobile').removeClass('desktop');
                this.model.set('_isDesktop', false)
            }
        },

        postRender: function() {
            this.renderState();
            this.$('.edgeAnimateMobile-slider').imageready(_.bind(function() {
                this.setReadyStatus();
            }, this));
            this.setupEdgeAnimateMobile();
        },

        // Used to check if the edgeAnimateMobile should reset on revisit
        checkIfResetOnRevisit: function() {
            var isResetOnRevisit = this.model.get('_isResetOnRevisit');

            // If reset is enabled set defaults
            if (isResetOnRevisit) {
                this.model.reset(isResetOnRevisit);
                this.model.set({_stage: 0});

                _.each(this.model.get('_narrative')._items, function(item) {
                    item.visited = false;
                });
            }
        },

        setupEdgeAnimateMobile: function() {
            this.setDeviceSize();
            this.model.set('_marginDir', 'left');
            if (Adapt.config.get('_defaultDirection') == 'rtl') {
                this.model.set('_marginDir', 'right');
            }
            this.model.set('_itemCount', this.model.get('_narrative')._items.length);

            this.model.set('_active', true);

            if (this.model.get('_stage')) {
                this.setStage(this.model.get('_stage'), true);
            } else {
                this.setStage(0, true);
            }
            this.calculateWidths();

            if (Adapt.device.screenSize !== 'large' && !this.model.get('_wasIframewithedgeAnimate')) {
                this.replaceInstructions();
            }
            this.setupEventListeners();
        },

        calculateWidths: function() {
            var slideWidth = this.$('.edgeAnimateMobile-slide-container').width();
            var slideCount = this.model.get('_itemCount');
            var marginRight = this.$('.edgeAnimateMobile-slider-graphic').css('margin-right');
            var extraMargin = marginRight === '' ? 0 : parseInt(marginRight);
            var fullSlideWidth = (slideWidth + extraMargin) * slideCount;
            var iconWidth = this.$('.edgeAnimateMobile-popup-open').outerWidth();

            this.$('.edgeAnimateMobile-slider-graphic').width(slideWidth);
            this.$('.edgeAnimateMobile-strapline-header').width(slideWidth);
            this.$('.edgeAnimateMobile-strapline-title').width(slideWidth);

            this.$('.edgeAnimateMobile-slider').width(fullSlideWidth);
            this.$('.edgeAnimateMobile-strapline-header-inner').width(fullSlideWidth);

            var stage = this.model.get('_stage');
            var margin = -(stage * slideWidth);

            this.$('.edgeAnimateMobile-slider').css(('margin-' + this.model.get('_marginDir')), margin);
            this.$('.edgeAnimateMobile-strapline-header-inner').css(('margin-' + this.model.get('_marginDir')), margin);

            this.model.set('_finalItemLeft', fullSlideWidth - slideWidth);
        },

        resizeControl: function() {
            this.setDeviceSize();
            this.replaceInstructions();
            this.calculateWidths();
            this.evaluateNavigation();
        },

        reRender: function() {
            if (this.model.get('_wasIframewithedgeAnimate') && Adapt.device.screenSize == 'large') {
                this.replaceWithIframewithedgeAnimate();
            } else {
                this.resizeControl();
            }
        },

        closeNotify: function() {
            this.evaluateCompletion()
        },

        replaceInstructions: function() {
            if (Adapt.device.screenSize === 'large') {
                this.$('.edgeAnimateMobile-instruction-inner').html(this.model.get('instruction'));
            } else if (this.model.get('mobileInstruction') && !this.model.get('_wasIframewithedgeAnimate')) {
                this.$('.edgeAnimateMobile-instruction-inner').html(this.model.get('mobileInstruction'));
            }
        },

        replaceWithIframewithedgeAnimate: function() {
            if (!Adapt.componentStore.iframewithedgeAnimate) throw "IframewithedgeAnimate not included in build";
            var IframewithedgeAnimate = Adapt.componentStore.iframewithedgeAnimate;

            var model = this.prepareIframewithedgeAnimateModel();
            var newHotgraphic = new IframewithedgeAnimate({model: model, $parent: this.options.$parent});
            this.options.$parent.append(newHotgraphic.$el);
            this.remove();
            _.defer(function() {
                Adapt.trigger('device:resize');
            });
        },

        prepareIframewithedgeAnimateModel: function() {
            var model = this.model;
            model.set('_component', 'iframewithedgeAnimate');
            model.set('body', model.get('originalBody'));
            model.set('instruction', model.get('originalInstruction'));
            return model;
        },

        moveSliderToIndex: function(itemIndex, animate, callback) {
            var extraMargin = parseInt(this.$('.edgeAnimateMobile-slider-graphic').css('margin-right'));
            var movementSize = this.$('.edgeAnimateMobile-slide-container').width() + extraMargin;
            var marginDir = {};
            if (animate) {
                marginDir['margin-' + this.model.get('_marginDir')] = -(movementSize * itemIndex);
                this.$('.edgeAnimateMobile-slider').velocity("stop", true).velocity(marginDir);
                this.$('.edgeAnimateMobile-strapline-header-inner').velocity("stop", true).velocity(marginDir, {complete:callback});
            } else {
                marginDir['margin-' + this.model.get('_marginDir')] = -(movementSize * itemIndex);
                this.$('.edgeAnimateMobile-slider').css(marginDir);
                this.$('.edgeAnimateMobile-strapline-header-inner').css(marginDir);
                callback();
            }
        },

        setStage: function(stage, initial) {
            this.model.set('_stage', stage);

            if (this.model.get('_isDesktop')) {
                // Set the visited attribute for large screen devices
                var currentItem = this.getCurrentItem(stage);
                currentItem.visited = true;
            }

            this.$('.edgeAnimateMobile-progress:visible').removeClass('selected').eq(stage).addClass('selected');
            this.$('.edgeAnimateMobile-slider-graphic').children('.controls').a11y_cntrl_enabled(false);
            this.$('.edgeAnimateMobile-slider-graphic').eq(stage).children('.controls').a11y_cntrl_enabled(true);
            this.$('.edgeAnimateMobile-content-item').addClass('edgeAnimateMobile-hidden').a11y_on(false).eq(stage).removeClass('edgeAnimateMobile-hidden').a11y_on(true);
            this.$('.edgeAnimateMobile-strapline-title').a11y_cntrl_enabled(false).eq(stage).a11y_cntrl_enabled(true);

            this.evaluateNavigation();
            this.evaluateCompletion();

            this.moveSliderToIndex(stage, !initial, _.bind(function() {
                if (this.model.get('_isDesktop')) {
                    if (!initial) this.$('.edgeAnimateMobile-content-item').eq(stage).a11y_focus();
                } else {
                    if (!initial) this.$('.edgeAnimateMobile-popup-open').a11y_focus();
                }
            }, this));
        },

        constrainStage: function(stage) {
            if (stage > this.model.get('_narrative')._items.length - 1) {
                stage = this.model.get('_narrative')._items.length - 1;
            } else if (stage < 0) {
                stage = 0;
            }
            return stage;
        },

        constrainXPosition: function(previousLeft, newLeft, deltaX) {
            if (newLeft > 0 && deltaX > 0) {
                newLeft = previousLeft + (deltaX / (newLeft * 0.1));
            }
            var finalItemLeft = this.model.get('_finalItemLeft');
            if (newLeft < -finalItemLeft && deltaX < 0) {
                var distance = Math.abs(newLeft + finalItemLeft);
                newLeft = previousLeft + (deltaX / (distance * 0.1));
            }
            return newLeft;
        },

        evaluateNavigation: function() {
            var currentStage = this.model.get('_stage');
            var itemCount = this.model.get('_itemCount');
            if (currentStage == 0) {
                this.$('.edgeAnimateMobile-control-left').addClass('edgeAnimateMobile-hidden');

                if (itemCount > 1) {
                    this.$('.edgeAnimateMobile-control-right').removeClass('edgeAnimateMobile-hidden');
                }
            } else {
                this.$('.edgeAnimateMobile-control-left').removeClass('edgeAnimateMobile-hidden');

                if (currentStage == itemCount - 1) {
                    this.$('.edgeAnimateMobile-control-right').addClass('edgeAnimateMobile-hidden');
                } else {
                    this.$('.edgeAnimateMobile-control-right').removeClass('edgeAnimateMobile-hidden');
                }
            }

        },

        getNearestItemIndex: function() {
            var currentPosition = parseInt(this.$('.edgeAnimateMobile-slider').css('margin-left'));
            var graphicWidth = this.$('.edgeAnimateMobile-slider-graphic').width();
            var absolutePosition = currentPosition / graphicWidth;
            var stage = this.model.get('_stage');
            var relativePosition = stage - Math.abs(absolutePosition);

            if (relativePosition < -0.3) {
                stage++;
            } else if (relativePosition > 0.3) {
                stage--;
            }

            return this.constrainStage(stage);
        },

        getCurrentItem: function(index) {
            return this.model.get('_narrative')._items[index];
        },

        getVisitedItems: function() {
            return _.filter(this.model.get('_narrative')._items, function(item) {
                return item.visited;
            });
        },

        evaluateCompletion: function() {
            if (this.getVisitedItems().length === this.model.get('_narrative')._items.length) {
                this.trigger('allItems');
            }
        },

        moveElement: function($element, deltaX) {
            var previousLeft = parseInt($element.css('margin-left'));
            var newLeft = previousLeft + deltaX;

            newLeft = this.constrainXPosition(previousLeft, newLeft, deltaX);
            $element.css(('margin-' + this.model.get('_marginDir')), newLeft + 'px');
        },

        preventDefault: function(event) {
            if(event && event.preventDefault) event.preventDefault();
        },

        openPopup: function(event) {
            event.preventDefault();
            var currentItem = this.getCurrentItem(this.model.get('_stage'));
            var popupObject = {
                title: currentItem.title,
                body: currentItem.body
            };

            // Set the visited attribute for small and medium screen devices
            currentItem.visited = true;

            Adapt.trigger('notify:popup', popupObject);
        },

        onNavigationClicked: function(event) {
            event.preventDefault();

            if (!this.model.get('_active')) return;

            var stage = this.model.get('_stage');
            var numberOfItems = this.model.get('_itemCount');

            if ($(event.currentTarget).hasClass('edgeAnimateMobile-control-right')) {
                stage++;
            } else if ($(event.currentTarget).hasClass('edgeAnimateMobile-control-left')) {
                stage--;
            }
            stage = (stage + numberOfItems) % numberOfItems;
            this.setStage(stage);
        },

        inview: function(event, visible, visiblePartX, visiblePartY) {
            if (visible) {
                if (visiblePartY === 'top') {
                    this._isVisibleTop = true;
                } else if (visiblePartY === 'bottom') {
                    this._isVisibleBottom = true;
                } else {
                    this._isVisibleTop = true;
                    this._isVisibleBottom = true;
                }

                if (this._isVisibleTop && this._isVisibleBottom) {
                    this.$('.component-inner').off('inview');
                    this.setCompletionStatus();
                }
            }
        },

        onCompletion: function() {
            this.setCompletionStatus();
            if (this.completionEvent && this.completionEvent != 'inview') {
                this.off(this.completionEvent, this);
            }
        },

        setupEventListeners: function() {
            var setCompletionOn = this.model.get('_narrative')._setCompletionOn;
            this.completionEvent = (!setCompletionOn) ? 'allItems' : setCompletionOn;
            if (this.completionEvent !== 'inview') {
                this.on(this.completionEvent, _.bind(this.onCompletion, this));
            } else {
                this.$('.component-widget').on('inview', _.bind(this.inview, this));
            }
        }

    });

    Adapt.register('edgeAnimateMobile', EdgeAnimateMobile);

    return EdgeAnimateMobile;

});
