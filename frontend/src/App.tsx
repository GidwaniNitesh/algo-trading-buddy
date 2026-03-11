// src/App.tsx
import React from 'react';
import { Provider } from 'react-redux';
import { reduxStore } from './store/reduxStore';
import Dashboard from './pages/Dashboard';

const App: React.FC = () => {
  return (
    <Provider store={reduxStore}>
      <Dashboard />
    </Provider>
  );
};

export default App;
