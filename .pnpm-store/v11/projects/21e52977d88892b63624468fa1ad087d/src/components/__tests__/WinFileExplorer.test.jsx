import React from 'react';
import { render, screen } from '@testing-library/react';
import { WinFileExplorer } from '../../components/WinFileExplorer';

test('renders file explorer tree with initial data', () => {
  render(<WinFileExplorer />);
  expect(screen.getByText('This PC')).toBeInTheDocument();
  expect(screen.getByText('Documents')).toBeInTheDocument();
  expect(screen.getByText('Pictures')).toBeInTheDocument();
  expect(screen.getByText('notes.txt')).toBeInTheDocument();
});
