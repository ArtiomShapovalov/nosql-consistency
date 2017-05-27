const initialState = [];

const testType = (state = 'mongo', action) => {
  switch (action.type) {
  case 'TEST_TYPE':
    return action.name
  default:
    return state;
  }
};

const result = (state = {}, action) => {
  switch (action.type) {
  case 'SET_RESULT':
    return action.result
  default:
    return state;
  }
};

const results = (state = initialState, action) => {
  switch (action.type) {
  case 'SET_RESULTS':
    return initialState.concat(action.results)
  default:
    return state;
  }
};

const tests = (state = initialState, action) => {
  switch (action.type) {
  case 'SET_TESTS':
    return initialState.concat(action.todos)
  default:
    return state;
  }
};

const isLoading = (state = false, action) => {
  switch (action.type) {
  case 'LOAD_TESTS':
    return true
  case 'COMPLETE_LOAD_TESTS':
    return false
  default:
    return state
  }
}

export default { tests, isLoading, result, results, testType };
