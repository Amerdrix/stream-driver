import Rx from 'rx'
import Immutable from 'immutable'

const IDENTITY = x => x
const META_KEY = '\u{270A}\u{270B}\u{270C}'
const INITIAL_HISTORY = Immutable.List();
const Transform = Immutable.Record({actionName: '', fn: IDENTITY, name: ''})
const ACTION_SUBJECT$ = new Rx.Subject();
const ASYNC_ACTION$$ = new Rx.Subject();


function _normalizeTransformResult(result) {

  var state = (result instanceof Immutable.Collection ? result : null) ||
              (result.state instanceof Immutable.Collection ? result.state : null)

  var action$ = (result instanceof Rx.Observable ? result.select(_normalizeAction) : null) ||
              (result.action$ instanceof Rx.Observable ? result.action$.select(_normalizeAction) : null)

  var rtn = { state, action$ }
  return rtn;
}

function _appendTransform(state, transform) {
  var existingTransforms = state.getIn([META_KEY, 'transforms', transform.actionName]) || Immutable.List()
  var newTransforms = existingTransforms.push(transform);
  return state.setIn([META_KEY, 'transforms', transform.actionName], newTransforms);
}

function _getActionTransforms(state, actionName) {
  return state.getIn([META_KEY, 'transforms', actionName]) || []
}

function _normalizeAction(actionLike) {
  var arr = [].concat(actionLike)
  return {action: arr[0], data: arr[1]}
}

function _applyActionTransform(state, transform, actionData) {
  var immutableActionData = Immutable.fromJS(actionData);
  var transformed = _normalizeTransformResult(transform.fn(state, actionData))

  if(!!transformed.action$)
  {
    ASYNC_ACTION$$.onNext(transformed.action$)
  }
  
  return (transformed.state || state)
    .setIn([META_KEY, 'causation', 'transform'], transform)
    .setIn([META_KEY, 'causation', 'data'], immutableActionData);
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
        '\u{270A}\u{270B}\u{270C}-reset-state': [new Transform({actionName: '\u{270A}\u{270B}\u{270C}-initialize', fn: () => INITIAL_STATE, name: "StreamDriver: Reset State"})],
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
const async_action$ = ASYNC_ACTION$$.selectMany(IDENTITY).observeOn(Rx.Scheduler.async)
const action$ = Rx.Observable.merge(ACTION_SUBJECT$, async_action$);
const state$ = action$.scan(_applyActionTransforms, INITIAL_STATE).replay(1);
const history$ = state$.scan(_pushHistory, INITIAL_HISTORY).replay(1);

class StreamDriver {
  static metaKey (){ return  META_KEY };

  constructor(builderFn = IDENTITY) {

    this._action$ = ACTION_SUBJECT$
    this.state$ = state$
    this.history$ = history$

    this.state$.connect();
    this.history$.connect();

    this.publishAction(`${META_KEY}-initialize`)()
    builderFn( new DriverBuilder(this));
  }

  publishAction(action){
    return (data) => {
      ACTION_SUBJECT$.onNext({
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
