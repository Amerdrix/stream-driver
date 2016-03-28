import Rx from 'rx'
import Immutable from 'immutable'

const IDENTITY = x => x
const META_KEY = '\u{270A}\u{270B}\u{270C}'
const INITIAL_HISTORY = Immutable.List();
const Transform = Immutable.Record({actionName: '', fn: IDENTITY, name: 'identity'})

function _appendTransform(state, transform) {
  var existingTransforms = state.getIn([META_KEY, 'transforms', transform.actionName]) || Immutable.List()
  var newTransforms = existingTransforms.push(transform);
  return state.setIn([META_KEY, 'transforms', transform.actionName], newTransforms);
}

function _getActionTransforms(state, actionName) {
  return state.getIn([META_KEY, 'transforms', actionName]) || []
}

function _applyActionTransform(state, transform, data) {
  var immutableData = Immutable.fromJS(data);
  var transformedState = transform.fn(state, data);
  return transformedState.setIn([META_KEY, 'causation', 'transform'], transform).setIn([META_KEY, 'causation', 'data'], immutableData)
}

function _applyActionTransforms(state, action) {
  const transforms = _getActionTransforms(state, action.action);
  return transforms.reduce((state, transform) => _applyActionTransform(state, transform, action.data),  state)
}

function _pushHistory(history, state) {
  return history.push(state);
}

const INITIAL_STATE = Immutable.fromJS(
  {
    '\u{270A}\u{270B}\u{270C}': {
    'transforms':
      {
        '\u{270A}\u{270B}\u{270C}-initialize': [new Transform({actionName: '\u{270A}\u{270B}\u{270C}-initialize', fn: IDENTITY, name: "StreamDriver: initialize"})],
        '\u{270A}\u{270B}\u{270C}-append-action-transform': [new Transform({actionName: '\u{270A}\u{270B}\u{270C}-append-action-transform', fn: _appendTransform, name: "StreamDriver: Append transform"})]
      }
    }
  }
);

class DriverBuilder {
  constructor(driver) {
    this._driver = driver;
  }

  appendTransform(actionName, transformationFn, transformName){
    var transform = new Transform({actionName, fn: transformationFn, name: transformName})
    this._driver.publishAction(`${META_KEY}-append-action-transform`)(transform)
  }
}

class StreamDriver {
  static metaKey (){ return  META_KEY };

  constructor(builderFn = IDENTITY) {
    this._action$ = new Rx.Subject();
    this.state$ = this._action$.scan(_applyActionTransforms, INITIAL_STATE).replay(1);
    this.history$ = this.state$.scan(_pushHistory, INITIAL_HISTORY).replay(1);

    this.state$.connect();
    this.history$.connect();

    this.publishAction(`${META_KEY}-initialize`)()
    builderFn( new DriverBuilder(this));
  }

  publishAction(action){
    return (data) => {
      this._action$.onNext({
        action,
        data
      });
    };
  }
}

const global = new StreamDriver();

export {
  global as default,
  global,
  StreamDriver
}
