import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

test('renders SSC landing title', () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );
  expect(screen.getByText('SSC')).toBeInTheDocument();
  expect(screen.getByText('Super Secure Chat')).toBeInTheDocument();
});