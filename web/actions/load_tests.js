import axios from 'axios';

export default () => dispatch => {
  dispatch({ type: 'LOAD_TESTS' });

  return axios({
    method: 'get',
    headers: { "Access-Control-Allow-Origin": "*" },
    url: 'http://localhost:3000'
  }).then(response => {
    dispatch({ type: 'SET_TESTS', todos: response.data })
    dispatch({ type: 'COMPLETE_LOAD_TESTS' })
  })
};
