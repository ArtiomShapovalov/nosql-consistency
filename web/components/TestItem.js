import React from 'react';

const TestItem = ({ text, index, score }) => (
  <li key={index}>
    <div>{text}{score !== null ? ` - вес: ${score}` : ''}</div>
  </li>
);

export default TestItem;
