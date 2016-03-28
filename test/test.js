import { expect } from 'chai'
import Rx from 'rx'
import Immutable from 'immutable'

import { action$, state$, StreamDriver } from '../src/stream-driver.js'

describe('state', () =>
  {
    var driver = null;
    var completedState$ = null
    var driverBuilder = null

    beforeEach(() => {
        driver = new StreamDriver((builder) => driverBuilder = builder);
        driver.publishAction('\u{270A}\u{270B}\u{270C}-reset-state')() // Magic action to reset the state of the driver

        completedState$ = driver.state$.takeUntilWithTime(15); // Some tests require async calls - so this is a tuning problem
    });

    afterEach(() => {
      driver = null;
      completedState$ = null
      driverBuilder = null
    })


    it('exposes state$', () => expect(driver).to.have.property('state$'))
    it('exposes history$', () => expect(driver).to.have.property('history$'))
    it('does not expose action$', () => expect(driver).to.not.have.property('action$'))

    describe('when action transforms return a new state', () => {
      beforeEach(() => {
        driverBuilder.appendTransform('test-action-true', (state) => state.set('test-action-result', true)  );
        driverBuilder.appendTransform('test-action-false', (state) => state.set('test-action-result', false)  );
      });

      it('updates state according to the transform (first transform added)', (done) => {
        driver.publishAction('test-action-true')();
        completedState$.last().subscribe(x => {
          expect(x.get('test-action-result')).to.be.true
          done();
        })
      });

      it('updates state in the order actions are published', (done) => {
        driver.publishAction('test-action-false')();
        driver.publishAction('test-action-true')();
        completedState$.last().subscribe(x => {
          expect(x.get('test-action-result')).to.be.true
          done();
        })
      });


      it('updates state according to the transform (second transform added)', (done) => {
        driver.publishAction('test-action-false')();
        completedState$.last().subscribe(x => {
          expect(x.get('test-action-result')).to.be.false
          done();
        })
      });
    });

    describe('when action transforms return an observable sequence of actions', () => {
      var TAG
      beforeEach(() => {
        TAG = {}

        driverBuilder.appendTransform('set-test-result', (state, data) => state.set('test-action-result', data)  );
      });

      it('dispatches the actions as they arive', (done) => {
        driverBuilder.appendTransform('test-action-async', (state, data) => {
          return Rx.Observable.just(['set-test-result', data])
        });

        driver.publishAction('test-action-async')(TAG);
        completedState$.last().subscribe(x => {
          expect(x.get('test-action-result')).to.be.equal(TAG)
          done();
        })
      });

      it('dispatches in the order actions in the order they arive', (done) => {
        driverBuilder.appendTransform('append-test-data', (state, data) => {
          var list = state.get('test-action-result') || Immutable.List()
          return state.set('test-action-result', list.push(data))
        })

        driverBuilder.appendTransform('test-action-async', (state, data) => {
          return Rx.Observable.range(1, data).select(x => ['append-test-data', x])
        });

        driver.publishAction('test-action-async')(3);
        completedState$.last().subscribe(x => {
          expect(x.get('test-action-result').toJS()).to.be.eql([1,2,3])
          done();
        })
      });
    });

    describe('when action transforms returns new state and an observable sequence of actions', () => {
      it('applies the state change from the state change, and subequent actions', (done) => {
        var TAG = {}

        driverBuilder.appendTransform('append-test-list', (state, data) => {
          var list = state.get('test-action-list') || Immutable.List()
          return state.set('test-action-list', list.push(data))
        });

        driverBuilder.appendTransform('test-action', (state, data) => {
          return {state: state.set('test-action-result', TAG), action$: Rx.Observable.range(1, data).select(x => ['append-test-list', x])};
        });

        driver.publishAction('test-action')(3);

        completedState$.last().subscribe(state => {
          expect(state.get('test-action-result')).to.be.equal(TAG)
          expect(state.get('test-action-list').toJS()).to.be.eql([1,2,3])
          done();
        });
      });
    });
  }
)
