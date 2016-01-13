import test from 'tape';
import {checkMatch} from 'script/helper/checkMatch';

test('Find match in the start of array', (assert) => {

    let list = [1, 1, 1, 0, 2, 2]

    assert.deepEqual(checkMatch(list), [0, 1, 2])
    assert.end();
});

test('Find match in the end of array', (assert) => {

    let list = [0, 0, 2, 1, 1, 1]

    assert.deepEqual(checkMatch(list), [3, 4, 5])
    assert.end();
});

test('Find match for more than 3', (assert) => {

    let list = [0, 0, 2, 1, 1, 1, 1, 0, 0]

    assert.deepEqual(checkMatch(list), [3, 4, 5, 6])
    assert.end();
});