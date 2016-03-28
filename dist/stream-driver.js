'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.StreamDriver = exports.global = exports.default = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _rx = require('rx');

var _rx2 = _interopRequireDefault(_rx);

var _immutable = require('immutable');

var _immutable2 = _interopRequireDefault(_immutable);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var IDENTITY = function IDENTITY(x) {
  return x;
};
var META_KEY = '✊✋✌';
var INITIAL_HISTORY = _immutable2.default.List();
var Transform = _immutable2.default.Record({ actionName: '', fn: IDENTITY, name: 'identity' });

function _appendTransform(state, transform) {
  var existingTransforms = state.getIn([META_KEY, 'transforms', transform.actionName]) || _immutable2.default.List();
  var newTransforms = existingTransforms.push(transform);
  return state.setIn([META_KEY, 'transforms', transform.actionName], newTransforms);
}

function _getActionTransforms(state, actionName) {
  return state.getIn([META_KEY, 'transforms', actionName]) || [];
}

function _applyActionTransform(state, transform, data) {
  var immutableData = _immutable2.default.fromJS(data);
  var transformedState = transform.fn(state, data);
  return transformedState.setIn([META_KEY, 'causation', 'transform'], transform).setIn([META_KEY, 'causation', 'data'], immutableData);
}

function _applyActionTransforms(state, action) {
  var transforms = _getActionTransforms(state, action.action);
  return transforms.reduce(function (state, transform) {
    return _applyActionTransform(state, transform, action.data);
  }, state);
}

function _pushHistory(history, state) {
  return history.push(state);
}

var INITIAL_STATE = _immutable2.default.fromJS({
  '✊✋✌': {
    'transforms': {
      '✊✋✌-initialize': [new Transform({ actionName: '✊✋✌-initialize', fn: IDENTITY, name: "StreamDriver: initialize" })],
      '✊✋✌-append-action-transform': [new Transform({ actionName: '✊✋✌-append-action-transform', fn: _appendTransform, name: "StreamDriver: Append transform" })]
    }
  }
});

var DriverBuilder = function () {
  function DriverBuilder(driver) {
    _classCallCheck(this, DriverBuilder);

    this._driver = driver;
  }

  _createClass(DriverBuilder, [{
    key: 'appendTransform',
    value: function appendTransform(actionName, transformationFn, transformName) {
      var transform = new Transform({ actionName: actionName, fn: transformationFn, name: transformName });
      this._driver.publishAction(META_KEY + '-append-action-transform')(transform);
    }
  }]);

  return DriverBuilder;
}();

var StreamDriver = function () {
  _createClass(StreamDriver, null, [{
    key: 'metaKey',
    value: function metaKey() {
      return META_KEY;
    }
  }]);

  function StreamDriver() {
    var builderFn = arguments.length <= 0 || arguments[0] === undefined ? IDENTITY : arguments[0];

    _classCallCheck(this, StreamDriver);

    this._action$ = new _rx2.default.Subject();
    this.state$ = this._action$.scan(_applyActionTransforms, INITIAL_STATE).replay(1);
    this.history$ = this.state$.scan(_pushHistory, INITIAL_HISTORY).replay(1);

    this.state$.connect();
    this.history$.connect();

    this.publishAction(META_KEY + '-initialize')();
    builderFn(new DriverBuilder(this));
  }

  _createClass(StreamDriver, [{
    key: 'publishAction',
    value: function publishAction(action) {
      var _this = this;

      return function (data) {
        _this._action$.onNext({
          action: action,
          data: data
        });
      };
    }
  }]);

  return StreamDriver;
}();

var global = new StreamDriver();

exports.default = global;
exports.global = global;
exports.StreamDriver = StreamDriver;