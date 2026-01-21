import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GeographySelector } from '../GeographySelector';

describe('GeographySelector', () => {
  const defaultProps = {
    currentLevel: 'zip' as const,
    currentRegion: { id: '60601', name: 'Chicago, IL 60601' },
    availableLevels: ['national', 'state', 'metro', 'county', 'zip'] as const,
    onSelect: vi.fn(),
  };

  describe('Rendering', () => {
    it('renders the label', () => {
      render(<GeographySelector {...defaultProps} />);
      expect(screen.getByText('Geography Level')).toBeInTheDocument();
    });

    it('renders a select element', () => {
      render(<GeographySelector {...defaultProps} />);
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('displays current level as selected value', () => {
      render(<GeographySelector {...defaultProps} currentLevel="metro" />);
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('metro');
    });

    it('renders all available levels as options', () => {
      render(<GeographySelector {...defaultProps} />);

      expect(screen.getByRole('option', { name: 'national' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'state' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'metro' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'county' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'zip' })).toBeInTheDocument();
    });

    it('only renders levels in availableLevels', () => {
      render(
        <GeographySelector
          {...defaultProps}
          availableLevels={['national', 'state', 'metro']}
        />
      );

      expect(screen.getByRole('option', { name: 'national' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'state' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'metro' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'county' })).not.toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'zip' })).not.toBeInTheDocument();
    });
  });

  describe('Level Selection', () => {
    it('calls onSelect when level changes', () => {
      const onSelect = vi.fn();
      render(<GeographySelector {...defaultProps} onSelect={onSelect} />);

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'state' } });

      expect(onSelect).toHaveBeenCalled();
    });

    it('passes current region and new level when switching to non-national level', () => {
      const onSelect = vi.fn();
      render(<GeographySelector {...defaultProps} onSelect={onSelect} />);

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'county' } });

      expect(onSelect).toHaveBeenCalledWith(
        { id: '60601', name: 'Chicago, IL 60601' },
        'county'
      );
    });

    it('sets region to United States when switching to national level', () => {
      const onSelect = vi.fn();
      render(<GeographySelector {...defaultProps} onSelect={onSelect} />);

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'national' } });

      expect(onSelect).toHaveBeenCalledWith(
        { id: 'national', name: 'United States' },
        'national'
      );
    });

    it('preserves current region when switching between non-national levels', () => {
      const onSelect = vi.fn();
      const customRegion = { id: 'IL', name: 'Illinois' };
      render(
        <GeographySelector
          {...defaultProps}
          currentLevel="state"
          currentRegion={customRegion}
          onSelect={onSelect}
        />
      );

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'metro' } });

      expect(onSelect).toHaveBeenCalledWith(customRegion, 'metro');
    });
  });

  describe('Styling', () => {
    it('has capitalize class for options', () => {
      render(<GeographySelector {...defaultProps} />);
      const select = screen.getByRole('combobox');
      expect(select).toHaveClass('capitalize');
    });
  });
});
