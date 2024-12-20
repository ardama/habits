import { createSelector } from '@reduxjs/toolkit';
import { computeHabit, type ComputedHabit, type Habit, type HabitUpdate } from '@t/habits';
import { type Measurement } from '@t/measurements';
import type { AppState, AuthState, DataState, RootState } from '@t/redux';
import type { User } from '@t/users';
import { SimpleDate } from '@u/dates';
import { useSelector } from 'react-redux';

const selectAppState = (state: RootState): AppState => state.app;
export const useAppState = () => useSelector(selectAppState);

const selectDarkMode = (state: RootState): boolean => state.app.darkMode;
export const useDarkMode = () => useSelector(selectDarkMode);

const selectAuthState = (state: RootState): AuthState => state.auth;
export const useAuthState = () => useSelector(selectAuthState);

const selectDataState = (state: RootState): DataState => state.data;
export const useDataState = () => useSelector(selectDataState);

// -----------------------------------------
// Auth selectors -------------------
export const selectUser = (state: RootState): User | null => state.auth.user;
export const useUser = () => useSelector(selectUser);

const selectAuthLoading = (state: RootState): boolean => state.auth.loading;
export const useAuthLoading = () => useSelector(selectAuthLoading);

const selectAuthError = (state: RootState): string | null => state.auth.error;
export const useAuthError = () => useSelector(selectAuthError);

// -----------------------------------------
// Measurement selectors -------------------
const selectMeasurements = (state: RootState): Measurement[] => state.data.measurements;
export const useMeasurements = () => useSelector(selectMeasurements);

const selectMeasurementCount = createSelector(
  selectMeasurements,
  (measurements) => measurements.length
);
export const useMeasurementCount = () => useSelector(selectMeasurementCount);

const selectMeasurementById = (id: string): (state: RootState) => Measurement | undefined => 
  createSelector(
    selectMeasurements,
    (measurements) => measurements.find(m => m.id === id)
  );
export const useMeasurement = (id: string) => useSelector(selectMeasurementById(id));

const selectMeasurementsByIds = (ids: string[]): (state: RootState) => (Measurement | undefined)[] => 
  createSelector(
    selectMeasurements,
    (measurements) => ids.map((id) => measurements.find(m => m.id === id))
  );
export const useMeasurementsByIds = (ids: string[]) => useSelector(selectMeasurementsByIds(ids));

// -----------------------------------------
// Habit selectors -------------------
const selectHabits = (state: RootState): Habit[] => state.data.habits;
export const useHabits = () => useSelector(selectHabits);


const selectComputedHabits = (date: SimpleDate = SimpleDate.today()): (state: RootState) => ComputedHabit[] => createSelector(
  selectHabits,
  (habits) => {
    return habits
      .map((habit) => computeHabit(habit, date))
      .sort((a, b) => a.priority - b.priority);
  }
);

export const useComputedHabits = (date: SimpleDate = SimpleDate.today()) => useSelector(selectComputedHabits(date));

const selectHabitCount = createSelector(
  selectComputedHabits,
  (habits) => habits.length
);
export const useHabitCount = (): number => useSelector(selectHabitCount);

const selectHabitById = (id: string) => 
  createSelector(
    selectComputedHabits(),
    (habits) => habits.find(h => h.id === id)
  );
export const useHabit = (id: string) => useSelector(selectHabitById(id));

const selectHabitsByMeasurement = (measurement: Measurement): (state: RootState) => ComputedHabit[] =>
  createSelector(
    selectComputedHabits(),
    (habits) => habits.filter(({ conditions }) => {
      return !!conditions.find(({ measurementId }) => measurementId === measurement.id);
    })
  );
export const useHabitsByMeasurement = (measurement: Measurement) => useSelector(selectHabitsByMeasurement(measurement));

// -----------------------------------------
// Complex selectors -----------------------
const selectMeasurementUsage = createSelector(
  [selectMeasurements, selectHabits, selectComputedHabits()],
  (measurements, habits, computedHabits) => {
    const map: Map<string, { measurements: string[], habits: string[], pastHabits: string[], any: boolean }> = new Map();
    const blankUsage = () => ({ measurements: [], habits: [], pastHabits: [], any: false });
    
    measurements.forEach((measurement) => {
      const { comboLeftId, comboRightId, type, id } = measurement;
      if (type !== 'combo') return;

      if (comboLeftId) {
        const usage = map.get(comboLeftId) || blankUsage();
        usage.measurements.push(id);
        usage.any = true;
        map.set(comboLeftId, usage);
      }
      if (comboRightId) {
        const usage = map.get(comboRightId) || blankUsage();
        usage.measurements.push(id);
        usage.any = true;
        map.set(comboRightId, usage);
      }
    });
    
    computedHabits.forEach(({ id: habitId, conditions }) => {
      conditions.forEach(({ measurementId }) => {
        const usage = map.get(measurementId) || blankUsage();
        usage.habits.push(habitId);
        usage.any = true;
        map.set(measurementId, usage);
      })
    });
    
    habits.forEach(({ id: habitId, updates }) => {
      updates.forEach(({ conditions }) => {
        conditions?.forEach(({ measurementId }) => {
          const usage = map.get(measurementId) || blankUsage();
          if (usage.habits.indexOf(habitId) === -1) {
            usage.pastHabits.push(habitId);
            usage.any = true;
            map.set(measurementId, usage);
          }
        });
      });
    });
    return map;
  }
);

export const useMeasurementUsage = () => useSelector(selectMeasurementUsage);