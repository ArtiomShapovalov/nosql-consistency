import axios from 'axios';

export default testType => dispatch => {
  console.log('test')
  console.log(testType)

  dispatch({type: 'LOAD_TESTS'});

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }

  return axios({
    method: 'post',
    headers,
    url: `http://localhost:3000/test/${testType}`,
    data: {}
  }).then(response => {
    console.log('I`ve got something')
    console.log(response)
    if (response && response.data && response.data.values) {
      dispatch({ type: 'SET_RESULT', result: response.data.result })
      dispatch({ type: 'SET_RESULTS', results: response.data.values })
    }
    dispatch({ type: 'COMPLETE_LOAD_TESTS' })
  })
};
