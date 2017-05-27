import React, {Component} from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import Select from 'react-select';
import 'react-select/dist/react-select.css';
import './app.css'

import TestItem from '../components/TestItem';
import loadTests from '../actions/load_tests';
import testDefault from '../actions/test_default';
import changeTestType from '../actions/change_test_type';

class App extends Component {
  componentWillMount() {
    this.props.loadTests();
  }

  render() {
    const { tests, isLoading, testDefault, result, results, changeTestType,
      testType } = this.props;

    var options = [
      { value: 'mongo', label: 'MongoDB' },
      { value: 'redis', label: 'Redis' },
      { value: 'cassandra', label: 'Cassandra' }
    ];

    const logChange = (val) => {
      console.log(val);
      switch (val.value) {
        case options[0].value:
          changeTestType({ type: 'TEST_TYPE', name: options[0].value });
          break;
        case options[1].value:
          changeTestType({ type: 'TEST_TYPE', name: options[1].value });
          break;
        case options[2].value:
          changeTestType({ type: 'TEST_TYPE', name: options[2].value });
          break;
        default:
          break;
      }
    }

    return (
      <div className="formInner">
        {isLoading
          ? <div className="infoInner">Список загружается...</div>
          : <div className="infoInner">
            <div className="selectInner">
              <Select
                className="typeSelect"
                name="testType"
                clearable={false}
                value={testType}
                options={options}
                onChange={logChange}
              />
            </div>

            <h1>Тесты</h1>
            <ul>
              {
                tests.map((t, index) =>
                  <TestItem
                    key={index}
                    index={index}
                    text={t.text}
                    score={results[index] ? results[index].score : null}
                  />
                )
              }
            </ul>

            {result && <p>{result.text}</p>}

            <br/>

            <button onClick={() => testDefault(testType)}>
              TEST
            </button>
          </div>
        }
      </div>
    );
  }
}

const mapStateToProps = state => {
  const  { tests, result, results, isLoading, testType } = state
  return {
    testType,
    tests,
    result,
    results,
    isLoading
  }
};

const mapDispatchToProps = dispatch => bindActionCreators(
  { loadTests, testDefault, changeTestType },
  dispatch
);

export default connect(mapStateToProps, mapDispatchToProps)(App);
