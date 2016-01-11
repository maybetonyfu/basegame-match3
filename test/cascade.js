import test from 'tape';
import {cascade} from 'script/helper/cascade';

test('Cascade should an array', (assert) => {

  let list = [1,1,2,3,-1,1,-1,0]
  
  assert.deepEqual(cascade(list), [-1,-1,1,1,2,3,1,0])
  assert.end();
});