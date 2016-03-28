import { expect } from 'chai'

var prettyjson = require('prettyjson');

import { action$, state$, StreamDriver } from '../src/stream-driver.js'

describe('state', () =>
  {
    var driver = null;
    var completedState$ = null
    var driverBuilder = null

    beforeEach(() => {
        driver = new StreamDriver((b) => driverBuilder = b);

        completedState$ = driver.state$.takeUntilWithTime(5); // It's all done inline so 5 should be more than enough
    });

    afterEach(() => {
      driver = null;
      completedState$ = null
      driverBuilder = null
    })


    it('exposes state$', () => expect(driver).to.have.property('state$'))
    it('exposes history$', () => expect(driver).to.have.property('history$'))
    it('does not expose action$', () => expect(driver).to.not.have.property('action$'))

    describe('when action transforms are added', () => {
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


      it('updates state according to the transform (second transform added)', (done) => {
        driver.publishAction('test-action-false')();
        completedState$.last().subscribe(x => {
          expect(x.get('test-action-result')).to.be.false
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

    });


  }
)
