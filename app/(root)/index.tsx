import { StyleSheet, View, ScrollView } from 'react-native';
import { useHabits, useMeasurements, useMeasurementsByIds, useRecordings, useUser } from '@s/selectors';
import { getMeasurementRecordingValue, getMeasurementTypeData, type Measurement } from '@t/measurements';
import { Checkbox, Icon, IconButton, ProgressBar, Surface, Text, useTheme, type MD3Theme } from 'react-native-paper';
import { createRecording, type Recording, type RecordingData } from '@t/recording';
import { Fragment, useEffect, useRef, useState } from 'react';
import { generateDates, SimpleDate } from '@u/dates';
import Header from '@c/Header';
import { useDispatch } from 'react-redux';
import { addRecording, editRecording, editRecordingData } from '@s/userReducer';
import { getHabitCompletion, getHabitPredicateIcon, getHabitPredicateLabel, type Habit } from '@t/habits';
import { formatNumber, formatTime } from '@u/helpers';
import Points from '@c/Points';


export default function HomeScreen() {
  const dispatch = useDispatch();
  const recordings = useRecordings();
  const measurements = useMeasurements();
  const habits = useHabits();
  const [dateIndex, setDateIndex] = useState(6);
  const [dates, setDates] = useState(generateDates(7, 0));
  const currentDate = dates[dateIndex];
  const weekStartDateIndex = dateIndex - currentDate.getDayOfWeek();
  const weekDates = dates.slice(weekStartDateIndex, Math.min(weekStartDateIndex + 7, dates.length));
  const user = useUser();

  const theme = useTheme();
  const styles = createStyles(theme);

  const recording = recordings.find(({ date }) => date === currentDate.toString());
  const weekRecordings = weekDates.map((weekDate) => recordings.find(({ date }) => date === weekDate.toString()));
  useEffect(() => {
    weekRecordings.forEach((weekRecording, index) => {
      const weekDateIndex = weekStartDateIndex + index;

      if (weekRecording && weekDateIndex !== dates.length - 1) return;

      const newRecordingData: RecordingData[] = measurements.map((m) => ({
        measurementId: m.id,
        value: m.defaultValue,
      }));
  
      if (weekRecording) {
        let overlapCount = 0;
        newRecordingData.map((newData) => {
          const existingData = weekRecording.data.find(({ measurementId }) => measurementId === newData.measurementId);
          overlapCount += existingData ? 1 : 0;
          return existingData || newData;
        });
  
        if (overlapCount === newRecordingData.length && overlapCount === weekRecording.data.length) return;
        dispatch(editRecording({ id: weekRecording.id, updates: { ...weekRecording, data: newRecordingData }}));
      } else {
        const newRecording = createRecording(user.id, weekDates[index].toString(), newRecordingData);
        dispatch(addRecording(newRecording));
      }
    })
  }, [weekStartDateIndex, weekRecordings, weekDates, measurements]);  

  const dailyHabits = habits.filter((h) => !h.isWeekly)
  const weeklyHabits = habits.filter((h) => h.isWeekly);
  const weekDailyHabitPointTotals = weekDates.map((_, index) => {
    return dailyHabits.reduce((previous: number, current: Habit) => {
      const [complete, _, __] = getHabitCompletion(current, [recordings[index]], measurements);  
      return previous + (complete ? current.points : 0);
    }, 0);
  });

  const weekWeeklyHabitPointTotals = [0, 0, 0, 0, 0, 0, 0];
  weeklyHabits.forEach((habit) => {
    const firstCompletionIndex = habit.isWeekly ? [undefined, undefined, undefined, undefined, undefined, undefined, undefined].map((_, index) => {
      const recordings = weekRecordings.slice(0, index + 1);
      const [complete] = getHabitCompletion(habit, recordings, measurements);
      return complete;
    }).findIndex((completion) => completion) : -1;

    if (firstCompletionIndex !== -1) weekWeeklyHabitPointTotals[firstCompletionIndex] += habit.points;
  });

  const dailyPointTotal = (
    weekDailyHabitPointTotals[currentDate.getDayOfWeek()]
    + weekWeeklyHabitPointTotals[currentDate.getDayOfWeek()]
  );
  const cumulativeWeeklyPointTotal = (
    weekDailyHabitPointTotals.slice(0, currentDate.getDayOfWeek() + 1).reduce((previous: number, current: number) => previous + current, 0)
    + weekWeeklyHabitPointTotals.slice(0, currentDate.getDayOfWeek() + 1).reduce((previous: number, current: number) => previous + current, 0)
  );

  const overallWeeklyPointTotal = weekWeeklyHabitPointTotals.reduce((acc, curr, index) => acc + curr + (weekDailyHabitPointTotals[index] || 0), 0);

  const weeklyPointTarget = habits.reduce((previous: number, current: Habit) => {
    return previous + current.points * (current.isWeekly ? 1 : current.daysPerWeek);
  }, 0);

  const proratedWeeklyTarget = weeklyPointTarget * weekDates.length / 7; 
  const dailyPointTarget = weeklyPointTarget / 7;

  const weeklyMeasurementValues = new Map<string, (number | null)[]>();
  weekRecordings.forEach((weeklyRecording, index) => {
    weeklyRecording?.data.forEach(({ measurementId }) => {
      const current = weeklyMeasurementValues.get(measurementId) || [null, null, null, null, null, null, null];
      const value = getMeasurementRecordingValue(measurementId, measurements, weeklyRecording);
      current[index] = value;
      weeklyMeasurementValues.set(measurementId, current);
    })
  })

  let dateLabel = currentDate.toFormattedString();
  if (dateIndex === dates.length - 1) dateLabel = 'Today';
  else if (dateIndex === dates.length - 2) dateLabel = 'Yesterday';

  const measurementScopes = ['Day', 'Week'];
  const [measurementScope, setMeasurementScope] = useState(0);

  const habitScopes = ['Day', 'Week'];
  const [habitScope, setHabitScope] = useState(1);

  const longPressPreviousTimeout = useRef<null | NodeJS.Timeout>(null);
  const longPressNextTimeout = useRef<null | NodeJS.Timeout>(null);
  const weeklyJumpCount = 30;
  const handleLongPressPrevious = (index: number, delay: number = 250, count: number = 1) => {
    const jump = count > weeklyJumpCount ? 1 : 1;
    let nextDayIndex = index - jump;
    if (nextDayIndex < 7) {
      setDates((current) => [...generateDates(14, current.length), ...current]);
      nextDayIndex += 14;
    }
    setDateIndex(nextDayIndex);
    
    const nextDelay = count > weeklyJumpCount ? 25 : Math.max(delay - 25, 100);
    longPressPreviousTimeout.current = setTimeout(() => handleLongPressPrevious(nextDayIndex, nextDelay, count + 1), delay);
  }

  const handleLongPressNext = (index: number, delay: number = 250, count: number = 1) => {
    const jump = count > weeklyJumpCount ? 1 : 1;
    const nextDayIndex = Math.min(dates.length - 1, index + jump);
    setDateIndex(nextDayIndex);

    const nextDelay = count > weeklyJumpCount ? 25 : Math.max(delay - 25, 100);
    longPressNextTimeout.current = setTimeout(() => handleLongPressNext(nextDayIndex, nextDelay, count + 1), delay);
  }
  return (
    <>
      <Header title='Overview' />
      <View style={styles.container}>
        <View style={styles.headerSection}>
          <Surface style={styles.recordingHeaderContainer}>
            <View style={styles.recordingHeader}>
              {dateIndex === dates.length - 1 ? (
                <View style={styles.recordingHeaderIcon}>
                  <Icon source='calendar-today' size={26} color={theme.colors.primary} />
                </View>
              ) : null}
              <Text style={styles.recordingHeaderDate} variant='titleLarge'>
                {dateLabel}
              </Text>
              <IconButton
                style={styles.recordingHeaderButton}
                icon={'chevron-left'}
                onPress={() => {
                  if (dateIndex < 7) {
                    setDates([...generateDates(7, dates.length), ...dates]);
                    setDateIndex(dateIndex + 6);
                  } else {
                    setDateIndex(dateIndex - 1);
                  }
                }}
                onLongPress={() => handleLongPressPrevious(dateIndex)}
                onPressOut={() => {
                  if (longPressPreviousTimeout.current === null) return;
                  clearTimeout(longPressPreviousTimeout.current);
                  longPressPreviousTimeout.current = null;
                }}
                delayLongPress={600}
                />
              <IconButton
                style={styles.recordingHeaderButton}
                icon={'chevron-right'}
                disabled={dateIndex >= dates.length - 1}
                onPress={() => {
                  setDateIndex(Math.min(dates.length - 1, dateIndex + 1));
                }}
                onLongPress={() => handleLongPressNext(dateIndex)}
                onPressOut={() => {
                  if (longPressNextTimeout.current === null) return;
                  clearTimeout(longPressNextTimeout.current);
                  longPressNextTimeout.current = null;
                }}
                delayLongPress={600}
              />
              <IconButton
                style={styles.recordingHeaderButton}
                icon={'page-last'}
                disabled={dateIndex >= dates.length - 1}
                onPress={() => {
                  setDateIndex(dates.length - 1);
                }}
              />
            </View>
          </Surface>
          <View style={styles.weekContainer}>
            <View style={styles.weekProgressContainer}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <View
                  key={index}
                  style={{
                    ...styles.weekday,
                    left: `${100 * (index + 1) / 7}%`,
                    }}
                  >
                  <Text style={{ ...styles.weekdayText, ...(index === currentDate.getDayOfWeek() ? styles.weekdayTextToday : {})}} variant='titleSmall'>{day}</Text>
                  {currentDate.getDayOfWeek() === index ? <View style={styles.weekProgressMarker} /> : null}
                </View>
              ))}
              <View style={styles.progressContainer}>
                <ProgressBar
                  progress={(overallWeeklyPointTotal) / weeklyPointTarget}
                  style={styles.baseProgress}
                  color={theme.colors.inversePrimary}
                />
              </View>
              <View style={styles.progressContainer}>
                <ProgressBar
                  progress={(overallWeeklyPointTotal) / weeklyPointTarget}
                  style={styles.overlapProgress}
                  color={theme.colors.onSurfaceDisabled}
                />
              </View>
              <View style={styles.progressContainer}>
                <ProgressBar
                  progress={cumulativeWeeklyPointTotal / weeklyPointTarget}
                  style={styles.overlapProgress}
                  color={theme.colors.primary}
                />
              </View>
              <View style={styles.progressContainer}>
                <ProgressBar
                  progress={(cumulativeWeeklyPointTotal - dailyPointTotal) / weeklyPointTarget}
                  style={styles.overlapProgress}
                  color={theme.colors.inversePrimary}
                />
              </View>
              <View style={styles.progressContainer}>
                <ProgressBar
                  progress={(cumulativeWeeklyPointTotal - dailyPointTotal) / weeklyPointTarget}
                  style={styles.overlapProgress}
                  color={theme.colors.onSurfaceDisabled}
                />
              </View>
            </View>
            <View style={styles.weekPointsContainer}>
              <Points style={{ height: 28, minWidth: 38 }} points={overallWeeklyPointTotal} />
              <Text style={styles.weekPointsDivider}> / </Text>
              <Text style={styles.weekPointsTarget}>{weeklyPointTarget}</Text>
            </View>
          </View>
        </View>
        <ScrollView style={styles.content}>
          <View style={styles.recordingContainerHeader}>
            <View style={styles.recordingContainerHeaderIcon}>
              <Icon source='clipboard-edit-outline' size={18} />
            </View>
            <Text style={styles.recordingTitle} variant='titleMedium'>Measurements</Text>
            <IconButton
              style={styles.recordingHeaderScopeButton}
              icon={'chevron-left'}
              size={18}
              iconColor={theme.colors.primary}
              onPress={() => { setMeasurementScope(measurementScope - 1) }}
              disabled={measurementScope === 0}
            />
            <Text variant='titleSmall' style={styles.recordingHeaderScopeText}>
              {measurementScopes[measurementScope]}
            </Text>
            <IconButton
              style={styles.recordingHeaderScopeButton}
              icon={'chevron-right'}
              size={18}
              iconColor={theme.colors.primary}
              disabled={measurementScope === measurementScopes.length - 1}
              onPress={() => { setMeasurementScope(measurementScope + 1); }}
            />
          </View>
          <View style={styles.recordingContainer}>
            {!recording ? null : (
              <View style={styles.recordingView}>
                {
                  recording.data
                  .filter((d) => measurements.find(({ id }) => id === d.measurementId )?.archived !== true)
                  .toSorted((a, b) => {
                    const aPriority = measurements.find(({ id }) => id === a.measurementId )?.priority || 0;
                    const bPriority = measurements.find(({ id }) => id === b.measurementId )?.priority || 0;
                    return aPriority - bPriority;
                  }).map((data) => {
                    const measurement = measurements.find(({ id }) => id === data.measurementId );
                    if (!measurement) return null;
                    return (
                      <RecordingMeasurementItem
                        key={data.measurementId}
                        measurement={measurement}
                        currentDate={currentDate}
                        weekMeasurementValues={weeklyMeasurementValues}
                        scope={measurementScopes[measurementScope].toLowerCase()}
                        onPlus={(value, measurement) => {
                          const nextValue = value + measurement.step;
                          const updates = { value: nextValue };
                          dispatch(editRecordingData({ id: recording.id, measurementId: measurement.id, updates }));
                        }}
                        onMinus={(value, measurement) => {
                          const nextValue = Math.max(0, value - measurement.step);
                          const updates = { value: nextValue };
                          dispatch(editRecordingData({ id: recording.id, measurementId: measurement.id, updates }));                        
                        }}
                        onToggle={(toggled) => {
                          const updates = { value: toggled ? 1 : 0};
                          dispatch(editRecordingData({ id: recording.id, measurementId: measurement.id, updates }));                        
                        }}
                      />
                    );
                  })
                }
              </View>
            )}
          </View>
          <View style={styles.recordingContainerHeader}>
            <View style={styles.recordingContainerHeaderIcon}>
              <Icon source='checkbox-multiple-marked-outline' size={18} />
            </View>
            <Text style={styles.recordingTitle} variant='titleMedium'>Habits</Text>
            <IconButton
              style={styles.recordingHeaderScopeButton}
              icon={'chevron-left'}
              size={18}
              iconColor={theme.colors.primary}
              onPress={() => { setHabitScope(habitScope - 1) }}
              disabled={habitScope === 0}
            />
            <Text variant='titleSmall' style={styles.recordingHeaderScopeText}>
              {habitScopes[habitScope]}
            </Text>
            <IconButton
              style={styles.recordingHeaderScopeButton}
              icon={'chevron-right'}
              size={18}
              iconColor={theme.colors.primary}
              disabled={habitScope === habitScopes.length - 1}
              onPress={() => { setHabitScope(habitScope + 1); }}
            />
          </View>
          <View style={styles.recordingContainer}>
            <View style={styles.dailyPointTotalContainer}>
              {habitScopes[habitScope] === 'Week' ? (
                <>
                  {/* <Text style={{...styles.dailyPointTotalTitle, flex: 1}} variant='titleMedium'>Daily totals: </Text> */}
                  {weekWeeklyHabitPointTotals.map((weekly, index) => {
                    const daily = weekDailyHabitPointTotals[index] || 0;
                    const total = daily + weekly;
                    
                    return (
                      <View key={index}>
                        <Points style={styles.dailyPointTotal} points={total} size='small' disabled={index !== currentDate.getDayOfWeek()} />
                      </View>
                    )
                  })}
                </>
              ) : (
                <>
                  <Text style={styles.dailyPointTotalTitle} variant='titleMedium'>Daily total: </Text>
                  <View>
                    <Points style={styles.dailyPointTotal} points={dailyPointTotal} size='large' />
                  </View>
                </>
              )}
            </View>
            <View style={styles.recordingView}>
              {
                habits
                .filter((h) => h.archived !== true)
                .toSorted((a, b) => (a.priority || 0) - (b.priority || 0))
                .map((habit) => {
                  if (!recording) return null;

                  return (
                    <RecordingDataHabit
                      key={habit.habitId}
                      dayRecording={recording}
                      habit={habit}
                      scope={habitScopes[habitScope].toLowerCase()}
                      currentDate={currentDate}
                      weekRecordings={weekRecordings}
                    />
                  );
                })
              }
            </View>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const createStyles = (theme: MD3Theme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSection: {
    padding: 16,
  },
  recordingHeaderContainer: {
    paddingVertical: 4,
    flexGrow: 0,
    flexShrink: 0,
    borderRadius: 16,
  },
  recordingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8
  },
  recordingHeaderDate: {
    flex: 1,
    paddingLeft: 12,
    color: theme.colors.primary,
  },
  recordingHeaderIcon: {
    paddingLeft: 8,
  },
  recordingHeaderButton: {
    marginHorizontal: 2,
  },
  weekContainer: {
    flexGrow: 0,
    flexShrink: 0,
    marginHorizontal: 8,
    marginTop: 8,
    flexDirection: 'row',
    height: 64,
  },
  weekday: {
    position: 'absolute',
    top: 32,
    width: 32,
    height: 32,
    lineHeight: 32,
    textAlign: 'center',
    marginLeft: -16,
    borderRadius: 16,
  },
  weekdayText: {
    textAlign: 'center',
    color: theme.colors.onSurfaceDisabled,
  },
  weekdayTextToday: {
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
  weekProgressContainer: {
    position: 'relative',
    flex: 1,
  },
  progressContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
  },
  overlapProgress: {
    height: 12,
    borderRadius: 6,
    flexGrow: 0,
    marginTop: 14,
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  baseProgress: {
    height: 12,
    borderRadius: 6,
    flexGrow: 0,
    marginTop: 14,
    marginBottom: 4,
  },
  weekProgressMarker: {
    top: 22,
    position: 'absolute',
    height: 6,
    width: 6,
    backgroundColor: theme.colors.primary,
    borderRadius: 6,
    flexGrow: 0,
    left: 13,
  },
  weekPointsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 6,
    marginLeft: 12,
    alignItems: 'flex-start',
  },
  weekPointsDivider: {
    marginHorizontal: 1,
    lineHeight: 28,
    fontSize: 16,
    color: theme.colors.outline,
  },
  weekPointsTarget: {
    fontSize: 16,
    lineHeight: 28,
    color: theme.colors.outline,
  },
  weekPointsIcon: {
    marginTop: 4,
    marginLeft: 4,
  },
  scopeButtonsContainer: {
    position: 'absolute',
    bottom: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    height: 38,
    width: '100%',
  },
  scopeButtonsWrapper: {
    position: 'absolute',

    width: '40%',
    minWidth: 300,
    borderRadius: 19,
  },
  scopeButtons: {
  },
  scopeButton: {
    borderWidth: 0,
  },
  scopeButtonLabel: {    
  },
  content: {
    // paddingHorizontal: 16,
    paddingTop: 0,
    // paddingBottom: 72,
  },
  recordingContainerHeader: {
    flexDirection: 'row',
    height: 48,
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
    backgroundColor: theme.colors.surfaceVariant,
  },
  recordingContainerHeaderIcon: {
    marginLeft: 8
  },
  recordingTitle: {
    borderRadius: 16,
    flex: 1,
    // color: theme.colors.primary,
  },
  recordingHeaderScopeButton: {

  },
  recordingHeaderScopeText: {
    width: 48,
    textAlign: 'center',
    color: theme.colors.primary,
  },
  recordingContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  recordingView: {
    
  },
  recordingDivider: {
    marginVertical: 24,
  },
  dailyPointTotalContainer: {
    marginTop: 8,
    height: 28,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  dailyPointTotal: {
    width: 36,
    justifyContent: 'center',
  },
  dailyPointTotalTitle: {
    // flex: 1,
    marginRight: 8,
    color: theme.colors.primary,
  },
});

type RecordingMeasurementItemProps = {
  measurement: Measurement,
  currentDate: SimpleDate,
  weekMeasurementValues: Map<string, (number | null)[]>,
  scope: string,
  onPlus: ((currentValue: number, measurement: Measurement) => void) | undefined,
  onMinus: ((currentValue: number, measurement: Measurement) => void) | undefined,
  onToggle: ((toggled: boolean) => void) | undefined,
}

const RecordingMeasurementItem = ({ measurement, currentDate, weekMeasurementValues, scope, onPlus, onMinus, onToggle } : RecordingMeasurementItemProps) : JSX.Element | null  => {
  const theme = useTheme();
  const typeData = getMeasurementTypeData(measurement.type);
  if (!typeData) return null;
  
  const isBool = measurement.type === 'bool';
  const isTime = measurement.type === 'time';
  const isCombo = measurement.type === 'combo';
  
  const longPressLeftInterval = useRef<null | NodeJS.Timeout>(null);
  const longPressRightInterval = useRef<null | NodeJS.Timeout>(null);

  const weeklyValues = weekMeasurementValues.get(measurement.id) || [];
  const value = weeklyValues[currentDate.getDayOfWeek()] || 0;

  const valueRef = useRef(value);
  const measurementRef = useRef(measurement);

  useEffect(() => {
    valueRef.current = value;
    measurementRef.current = measurement;
  }, [value, measurement]);

  const handleLongPressLeft = () => {
    longPressLeftInterval.current = setInterval(() => {
      onMinus && onMinus(valueRef.current, measurementRef.current);
    }, 125);
  }
  const handleLongPressRight = () => {
    longPressRightInterval.current = setInterval(() => {
      onPlus && onPlus(valueRef.current, measurementRef.current);
    }, 125);
  }

  let controlContent;
  if (scope === 'week') {
    const sum = weeklyValues.reduce((acc: number, curr) => acc + (curr || 0), 0);
    const count = weeklyValues.reduce((acc: number, curr) => acc + (curr === null ? 0 : 1), 0);
    const value = isTime ? formatTime(sum / count) : formatNumber(sum);
    const unit = isTime ? '(average)' : measurement.unit;
    controlContent = (
      <View style={[measurementStyles.content, { marginRight: 16 }]}>
        <Text style={measurementStyles.value} variant='titleMedium'>{value}</Text>
        {unit ? <Text style={measurementStyles.valueLabel} variant='bodyLarge'>{unit}</Text> : null}
        {isBool ? (
          <View style={measurementStyles.valueLabel}>
            <Icon source='check' size={18} />
          </View>
        ) : null}
      </View>
    );
  } else if (isBool) {
    controlContent = (
      <View style={measurementStyles.content}>
        <Text style={measurementStyles.value} variant='titleMedium'> </Text>
        <IconButton size={18} mode={!value ? 'contained' : undefined} icon='window-close' onPress={() => {
          onToggle && onToggle(false);
        }}/>
        <IconButton size={18} mode={value ? 'contained' : undefined} icon='check' onPress={() => {
          onToggle && onToggle(true);
        }}/>
      </View>
    );
  } else {
    let valueString = isTime ? formatTime(value) : formatNumber(value);
    controlContent = (
      <View style={measurementStyles.content}>
        <Text style={measurementStyles.value} variant='titleMedium'>{valueString}</Text>
        {measurement.unit ? <Text style={measurementStyles.valueLabel} variant='bodyLarge'>{measurement.unit}</Text> : null}
        {isCombo ? <View style={{marginRight: 16}} /> : (
          <>
            <IconButton
              size={18}
              icon='minus'
              disabled={!value}
              onPress={() => {
                onMinus && onMinus(value, measurement);
              }}
              onLongPress={() => {
                handleLongPressLeft();
              }}
              onPressOut={() => {
                if (longPressLeftInterval.current === null) return;
                clearInterval(longPressLeftInterval.current);
                longPressLeftInterval.current = null;
              }}
              delayLongPress={250}
            />
            <IconButton
              size={18}
              icon='plus'
              onPress={() => {
                onPlus && onPlus(value, measurement);
              }}
              onLongPress={() => {
                handleLongPressRight();
              }}
              onPressOut={() => {
                if (longPressRightInterval.current === null) return;
                clearInterval(longPressRightInterval.current);
                longPressRightInterval.current = null;
              }}
              delayLongPress={250}
            />
          </>
        )}
      </View>
    )
  }
  return (
    <>
      <View style={measurementStyles.container}>
        <View style={measurementStyles.typeIconContainer}>
          <Icon source={typeData.icon} size={24} />
        </View>
          <Text numberOfLines={1} ellipsizeMode="tail" variant='titleMedium' style={measurementStyles.labelActivity}>{measurement.activity}</Text>
          {measurement.variant ? (
            <>
              <Text variant='bodyLarge' style={measurementStyles.labelDivider}> : </Text>
              <Text numberOfLines={1} ellipsizeMode="tail" variant='bodyLarge' style={[measurementStyles.labelVariant, { color: theme.colors.outline }]}>{measurement.variant}</Text>
            </>
          ) : null}
          {controlContent}
      </View>
    </>
  );
}

const measurementStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
  },
  typeIconContainer: {
    marginRight: 12,
    marginLeft: 4,
  },
  labelActivity: {
    flexShrink: 1,
  },  
  labelDivider: {
    marginHorizontal: 1,
    flexShrink: 0,
  },
  labelVariant: {
    flexShrink: 1,
  },
  content: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: {
    flexGrow: 1,
    textAlign: 'right',
  },
  valueLabel: {
    marginLeft: 6,
    textAlign: 'right',
  },
});

type RecordingDataHabitProps = {
  habit: Habit,
  dayRecording: Recording,
  weekRecordings: (Recording | undefined)[],
  scope: string,
  currentDate: SimpleDate,
}

const RecordingDataHabit = (props : RecordingDataHabitProps) : JSX.Element | null => {
  const { habit, weekRecordings, scope, currentDate } = props;

  const theme = useTheme();
  const habitStyles = createHabitStyles(theme);
  const habitMeasurements = useMeasurementsByIds(habit.conditions.map(({ measurementId }) => measurementId));
  const measurements = useMeasurements();

  let content;
  if (scope === 'week') {
    const firstWeeklyCompletionIndex = habit.isWeekly ? [undefined, undefined, undefined, undefined, undefined, undefined, undefined].map((_, index) => {
      const recordings = weekRecordings.slice(0, index + 1);
      const [complete] = getHabitCompletion(habit, recordings, measurements);
      return complete;
    }).findIndex((completion) => completion) : -1;

    content = (
      <View style={habitStyles.checkboxes}>
        {[undefined, undefined, undefined, undefined, undefined, undefined, undefined].map((_, index) => {
          const recordings = habit.isWeekly ? weekRecordings : [weekRecordings[index]];
          const [complete] = getHabitCompletion(habit, recordings, measurements);
          
          const isToday = index === currentDate.getDayOfWeek();
          const isFuture = weekRecordings[index] === undefined
          let status = 'indeterminate';
          let color = theme.colors.surfaceVariant;
          if (isFuture) {
            status = 'unchecked';
          } else if (habit.isWeekly && firstWeeklyCompletionIndex !== -1) {
            if (index === firstWeeklyCompletionIndex) {
              status = 'checked';
              color = theme.colors.outlineVariant;
            } else if (index > firstWeeklyCompletionIndex) {
              status = 'unchecked';
            }
          } else if (complete) {
            color = theme.colors.outlineVariant;
            status = 'checked';
          }
          
          if (isToday) {
            color = theme.colors.primary;
          }
        
          return (
            <View
              key={index}
              style={habitStyles.checkboxContainer}>
              <Checkbox.IOS
                status={status as ('unchecked' | 'indeterminate' | 'checked')}
                color={color}
                pointerEvents='none'
                style={habitStyles.checkbox}
              />
            </View>
          );
        })}
      </View>
    );
  } else {
    const recordings = weekRecordings.slice(habit.isWeekly ? 0 : currentDate.getDayOfWeek(), currentDate.getDayOfWeek() + 1);
    const [complete, conditionCompletions, conditionValues, conditionProgressions] = getHabitCompletion(habit, recordings, measurements);

    const predicateColor = complete ? theme.colors.primary : theme.colors.onSurfaceDisabled;
  
    content = (
      <>
        <View style={habitStyles.progressContainers}>
          {habit.conditions.length === 1 ? null : (
            <View style={habitStyles.multipleConditionContainer}>
              <View style={habitStyles.predicateContainer}>
                <Icon source={getHabitPredicateIcon(habit.predicate)} size={14} color={predicateColor} />
                <Text style={{ ...habitStyles.predicate, color: predicateColor}} variant='titleSmall'>{getHabitPredicateLabel(habit.predicate)}</Text>
              </View>
              <Points points={habit.points} disabled={!complete} />
            </View>
          )}
          {habit.conditions.map((condition, index) => {
            const measurement = habitMeasurements[index];
            const conditionCompletion = conditionCompletions[index];
            const conditionValue = conditionValues[index];
            const conditionProgress = conditionProgressions[index];
            
            if (!measurement) return null;
            const isBool = measurement.type === 'bool';
            const isTime = measurement.type === 'time';

            const progressLabelColor = theme.colors.onSurface;
            const progressColor = conditionCompletion ? theme.colors.primary : theme.colors.onSurfaceDisabled;
            
            return (
              <Fragment key={`${condition.measurementId}${condition.target}`}>
                <View style={habitStyles.progressContainer}>
                  <View style={habitStyles.progressBarContainer}>
                    <ProgressBar
                      style={[habitStyles.progressBar, conditionCompletion ? habitStyles.progressBarComplete : {}]}
                      progress={conditionProgress}
                      color={progressColor}
                    />
                  </View>
                  <View style={habitStyles.progressLabel}>
                    {isBool ? (
                      <Icon
                        source={conditionValue ? 'check' : 'window-close'}
                        size={16}
                      />
                    ) : (
                      <Text style={{ ...habitStyles.progressLabelCurrent, color: progressLabelColor }} variant='bodyMedium'>
                        {isTime ? formatTime(conditionValue) : formatNumber(conditionValue)}
                      </Text>
                    )}
                    {false ? (
                      null
                    ) : (
                      <Text style={{ ...habitStyles.progressLabelDivider, color: progressLabelColor }} variant='bodyMedium'>
                        {' / '}
                      </Text>
                    )}
                    {measurement.type === 'bool' ? (
                      <Icon
                        source='check'
                        size={16}
                      />
                    ) : (
                      <Text style={{ ...habitStyles.progressLabelTarget, color: progressLabelColor }} variant='bodyMedium' numberOfLines={1}>
                        {isTime ? formatTime(condition.target) : formatNumber(condition.target)}{measurement?.unit ? ` ${ measurement?.unit}` : ''}
                      </Text>
                    )}
                  </View>
                  {habit.conditions.length === 1 ? (
                    <Points style={{ marginLeft: 4 }} points={habit.points} disabled={!complete} />
                  ) : (
                    <View style={[habitStyles.completionIcon, conditionCompletion ? habitStyles.completionIconComplete : {}]}>
                      <Icon
                        source={conditionCompletion ? 'check' : 'window-close'}
                        color={conditionCompletion ? theme.colors.onPrimary : theme.colors.onSurfaceDisabled}
                        size={16}
                      />
                    </View>
                  )}
                </View>
              </Fragment>
            )
          })}
        </View>
      </>
    );
  }

  return (
    <>
      <View style={habitStyles.container}>
        <View style={habitStyles.labelContainer}>
          <View style={habitStyles.titleContainer}>
            <View style={habitStyles.icon}>
              <Icon source={habit.isWeekly ? 'calendar-sync' : 'sync'} size={16} />
            </View>
            <Text variant='titleMedium'>{habit.name}</Text>
          </View>
          {scope === 'day' ? (
            <>
              {habit.conditions.map(({ measurementId, target }, index) => {
                const measurement = habitMeasurements[index];
                if (!measurement) return;

                const typeData = getMeasurementTypeData(measurement.type);    
                return  (
                  <View key={`${measurementId}${target}`} style={habitStyles.labelSubtitle}>
                    <View style={habitStyles.labelSubtitleIcon}>
                      <Icon source={typeData.icon} size={16} />
                    </View>
                    <Text numberOfLines={1} ellipsizeMode="tail" style={habitStyles.labelSubtitleActivity} variant='titleSmall'>{measurement?.activity}</Text>
                    {measurement.variant ? (
                      <>
                        <Text style={habitStyles.labelSubtitleDivider} variant='bodyMedium'> : </Text>
                        <Text numberOfLines={1} ellipsizeMode="tail" style={habitStyles.labelSubtitleVariant} variant='bodyMedium'>{measurement?.variant}</Text>
                      </>
                    ) : null}
                  </View>
                )
              })}
            </>
          ) : null}
        </View>
        {content}
      </View>
    </>
  );
}

const createHabitStyles = (theme: MD3Theme) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 4,
    paddingBottom: 12,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  icon: {
    marginRight: 2,
  },
  typeIconContainer: {
  },
  typeIcon: {
    
  },
  labelContainer: {
    flex: 1,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  predicateContainer: {
    marginRight: 4,
    flexDirection: 'row',
    alignItems: 'center',  
  },
  predicate: {
    color: theme.colors.outline,
    marginLeft: 5,
  },
  labelSubtitle: {
    flexDirection: 'row',
    alignItems: 'center',

    // backgroundColor: theme.colors.surfaceVariant,
    paddingLeft: 18,
    borderRadius: 8,
    marginTop: 6,
    paddingVertical: 4,
  },
  labelSubtitleIcon: {
    marginRight: 4,
  },
  labelSubtitleActivity: {
    flexGrow: 0,
    flexShrink: 1,
  },
  labelSubtitleDivider: {
    flexGrow: 0,
    flexShrink: 0,
  },
  labelSubtitleVariant: {
    color: theme.colors.outline,
    flexShrink: 0,
  },
  progressContainers: {
    height: '100%',
    width: '50%',
    flexGrow: 0,
    flexDirection: 'column',
    marginLeft: 8,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  multipleConditionContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  progressContainer: {
    width: '100%',
    flexGrow: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 6,
    paddingVertical: 3,
  },
  progressBarContainer: {
    flex: 1,
    position: 'relative',
    flexDirection: 'row',
    // alignItems: 'flex-start',
  },
  progressBar: {
    height: 7,
    borderRadius: 200,
    // borderWidth: 2,
    // borderColor: 'transparent',
    // backgroundColor: 'transparent',
  },
  progressBarComplete: {
    borderColor: theme.colors.primary,
  },
  progressLabel: {
    position: 'absolute',
    top: 9,
    right: 38,

    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    height: 22,
  },
  progressLabelCurrent: {
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'right',
  },
  progressLabelDivider: {
    marginHorizontal: 1,
  },
  progressLabelTarget: {

  },
  progressLabelIcon: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end'
  },
  completionIcon: {
    width: 22,
    height: 22,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  completionIconComplete: {
    backgroundColor: theme.colors.primary,
  },
  checkboxes: {
    flexDirection: 'row',
  },
  checkboxContainer: {
  },
  checkbox: {
    padding: 0,
  },
});
