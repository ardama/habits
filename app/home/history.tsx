import Header from '@c/Header';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Icon, IconButton, Menu, Surface, Switch, Text, TextInput, ToggleButton, TouchableRipple, useTheme, type MD3Theme } from 'react-native-paper';
import { Area, Chart, HorizontalAxis, Line, VerticalAxis } from 'react-native-responsive-linechart';
import { formatValue, movingAverage, range, triggerHaptic } from '@u/helpers';
import { useComputedHabits, useMeasurements } from '@s/selectors';
import { useIsFocused } from '@react-navigation/native';
import { SimpleDate } from '@u/dates';
import Points from '@c/Points';
import Heatmap from '@c/Heatmap';
import { computeHabit, getHabitCompletion, type ComputedHabit } from '@t/habits';
import { getMeasurementRecordingValue, getMeasurementTypeIcon } from '@t/measurements';
import BottomDrawer, { type BottomDrawerItem } from '@c/BottomDrawer';
import useDimensions from '@u/hooks/useDimensions';
import { Icons } from '@u/constants/Icons';
import { withAuth } from '@u/hocs/withAuth';
import type { Palette } from '@u/colors';
import { usePalettes } from '@u/hooks/usePalettes';

function HistoryScreen() {  
  const measurements = useMeasurements();
  const dimensions = useDimensions();

  const theme = useTheme();
  const { getCombinedPalette, globalPalette } = usePalettes();
  
  const [selectedDataIndex, setSelectedDataIndex] = useState(-1);
  
  const chartDurationItems = [
    { title: '1W', value: 7 },
    { title: '1M', value: 30 },
    { title: '3M', value: 90 },
    { title: '1Y', value: 365 },
    { title: 'ALL', value: 100000 },
  ];
  const [chartDurationTitle, setChartDurationTitle] = useState(chartDurationItems[1].title);
  const chartDurationValue = chartDurationItems.find(({ title }) => title === chartDurationTitle)?.value || 30;
  
  const [chartMeasurementId, setChartMeasurementId] = useState(measurements[0]?.id);
  const selectedMeasurement = measurements.find(({ id }) => id === chartMeasurementId) || null;
  const palette = getCombinedPalette(selectedMeasurement?.baseColor);
  const s = createStyles(theme, palette);

  const chartMeasurementItems: BottomDrawerItem<string>[] = measurements.map(({ id, name: activity, variant, type }) => {
    return {
      title: `${activity}${variant ? ` : ${variant}` : ''}`,
      value: id,
      icon: getMeasurementTypeIcon(type),
    }
  });
  const selectedMeasurementItem = chartMeasurementItems.find(({ value }) => value === chartMeasurementId) || null;
  const chartMeasurementDropdown = (
    <MeasurementChartDropdown
      label='Measurement'
      selectedItem={selectedMeasurementItem}
      items={chartMeasurementItems}
      onChange={(item) => {
        setChartMeasurementId(item.value);
        setSelectedDataIndex(-1);
      }}
    />
  );

  const chartTrendlineItems = [
    { title: 'None', value: '', icon: undefined },
    { title: '7-day average', value: '7', icon: undefined },
    { title: '14-day average', value: '14', icon: undefined },
    { title: '30-day average', value: '30', icon: undefined },
  ]
  const [chartTrendlineValue, setChartTrendlineValue] = useState(chartTrendlineItems[1]?.value);
  const chartTrendlineItem = chartTrendlineItems.find(({ value }) => value === chartTrendlineValue) || null;
  const chartTrendlineDropdown = (
    <MeasurementChartDropdown
      label='Trendline'
      selectedItem={chartTrendlineItem}
      items={chartTrendlineItems}
      onChange={(item) => {
        setChartTrendlineValue(item.value);
      }}
    />
  );

  const isFocused = useIsFocused();

  const today = SimpleDate.today();
  const renderMeasurementChartCard = (): JSX.Element | null => {
    const { recordings, step, unit, type } = selectedMeasurement || { recordings: [], step: 1 };
    const isBool = type === 'bool';
    const isTime = type === 'time';
    const measurementRecordingDates = recordings
      .map(({ date }) => date)
      .sort((a, b) => a.localeCompare(b))
      .map((date) => SimpleDate.fromString(date))
      .filter((date) => !date.after(today));
    
    const firstDateWithData = measurementRecordingDates[0];
    let chartDuration = chartDurationValue;
    if (firstDateWithData) chartDuration = Math.min(SimpleDate.daysBetween(firstDateWithData, today), chartDuration - 1);
    chartDuration = Math.max(chartDuration, 1);

    const selectedMeasurementData = measurementRecordingDates.map((date) => {
      const daysAgo = SimpleDate.daysBetween(date, today);
      const value = getMeasurementRecordingValue(selectedMeasurement?.id, date, measurements);
      return value === null ? null : {
        x: chartDuration - daysAgo,
        y: value,
      };
    }).filter((data) => data !== null);

    const movingAverageWindow = parseInt(chartTrendlineValue) || 0;
    const averageValues = movingAverage(selectedMeasurementData.map(({ y }) => y), movingAverageWindow);
    const averageData = selectedMeasurementData
      .map(({ x }, index) => ({
        x: x,
        y: averageValues[index],
      }))
    const filteredAverageData = averageData
      .filter((data): data is { x : number, y : number} => data.y !== null);

    let dotSize = 8;
    if (chartDuration > 400) dotSize = 1;
    else if (chartDuration > 200) dotSize = 2;
    else if (chartDuration > 80) dotSize = 4;
    else if (chartDuration > 40) dotSize = 5;
    else if (chartDuration > 20) dotSize = 6;

    const chartWidth = dimensions.window.width - 72;
    const chartPadding = Math.ceil(Math.max((dotSize), 1));
    const chartHeight = 300;

    const combinedDataValues = [...selectedMeasurementData.map(({ y }) => y), ...averageData.map(({ y }) => y)].filter((value) => value !== null);
    const verticalStep = step || 1;
    const verticalMinRaw = isBool ? 0 : combinedDataValues.length ? Math.min(...combinedDataValues) : 0;
    const verticalMinSteps = Math.floor(verticalMinRaw / verticalStep);
    const verticalMinUnits = verticalMinSteps * verticalStep;
    const verticalMaxRaw = isBool ? 1 : combinedDataValues.length ? Math.max(...combinedDataValues) : 1;
    const verticalMaxSteps = Math.max(Math.ceil(verticalMaxRaw / verticalStep), verticalMinSteps + 1);
    const verticalMaxUnits = verticalMaxSteps * verticalStep;
    const verticalOffset = (verticalMaxUnits - verticalMinUnits) * (chartPadding / chartHeight);
    const verticalSteps = 1 + verticalMaxSteps - verticalMinSteps;
    const stepsPerTick = Math.ceil(verticalSteps / 5);
    const tickCount = Math.ceil(verticalSteps / stepsPerTick); 
    const ticks = range(0, tickCount)
      .map((tickIndex) => {
        const stepsFromBottom = tickIndex * stepsPerTick;
        const unitsFromBottom = stepsFromBottom * step;
        const unitsFromZero = verticalMinUnits + unitsFromBottom;
        return unitsFromZero;
      });

    let horizontalMin = 0;
    const horizontalMax = chartDuration;
    const horizontalOffset = (horizontalMax - horizontalMin) * (chartPadding / chartWidth);

    const selectedDateDayOffset = selectedDataIndex === -1 ? 0 : selectedMeasurementData[selectedDataIndex].x;
    const selectedDate = today.toDate();
    selectedDate.setDate(selectedDate.getDate() - chartDuration + selectedDateDayOffset);
    const selectedDateString = `${SimpleDate.fromDate(selectedDate).toFormattedString(true)}: `;
    
    const selectedDateValue = selectedDataIndex === -1 ? null : selectedMeasurementData[selectedDataIndex].y;
    const selectedDateValueString = formatValue(selectedDateValue, type, unit, true);
    
    const selectedDateAverage = selectedDataIndex === -1 ? null : averageData[selectedDataIndex]?.y;
    const selectedDateAverageString = formatValue(selectedDateAverage, type, unit, true);
    const selectedDateAverageLabel = `${chartTrendlineItem?.title || ''}: `;

    const selectedVisibleData = selectedMeasurementData.filter(({ x }) => x >= 0);
    const recordingCount = selectedVisibleData.length;
    const total = selectedVisibleData.reduce((acc, curr) => acc + curr.y || 0, 0);
    const totalString = !!selectedMeasurement && !isTime ? formatValue(total, isBool ? 'count' : selectedMeasurement.type, selectedMeasurement.unit, true) : '--';
    const average = recordingCount ? total / recordingCount : 0;
    const averageString = !!selectedMeasurement ? formatValue(average, isBool ? 'count' : selectedMeasurement.type, selectedMeasurement.unit, true) : '--';
    return (
      <Surface style={s.cardContainer}>
        <View style={{ ...s.cardRow, justifyContent: 'flex-start', gap: 12 }}>
          <View style={{ flexGrow: 1, flexShrink: 1, width: '50%', gap: 4 }}>
            <Text variant='titleMedium'>Measurement</Text>
            <View style={{ flexDirection: 'row'}}>
              {chartMeasurementDropdown}
            </View>
          </View>
          <View style={{ flexGrow: 1, flexShrink: 1, width: '50%', padding: 10}}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text variant='labelMedium'>Recordings</Text>
              <Text variant='bodyMedium' style={{ flexGrow: 1, textAlign: 'right' }}>{recordingCount}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text variant='labelMedium'>Total</Text>
              <Text variant='bodyMedium' style={{ flexGrow: 1, textAlign: 'right' }}>{totalString}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text variant='labelMedium'>Average</Text>
              <Text variant='bodyMedium' style={{ flexGrow: 1, textAlign: 'right' }}>{averageString}</Text>
            </View>
          </View>
        </View>
        <View style={s.cardRow}>
          {isFocused ? (
            <View style={{ paddingTop: 52, paddingBottom: 24 }}>
              <Chart
                xDomain={{
                  min: horizontalMin - horizontalOffset,
                  max: horizontalMax + horizontalOffset,
                }}
                yDomain={{
                  min: verticalMinUnits - verticalOffset,
                  max: verticalMaxUnits + verticalOffset,
                }}
                style={{
                  height: chartHeight,
                  width: chartWidth,
                }}
                padding={{
                  top: 0,
                  bottom: 0,
                }}
              >
                {selectedMeasurementData.length > 1 ? (
                  <Area
                    data={selectedMeasurementData}
                    smoothing='cubic-spline'
                    theme={{
                      gradient: {
                        from: {
                          color: palette.primary,
                          opacity: 0.25
                        },
                        to: {
                          color: palette.primary,
                          opacity: 0
                        }
                      }
                    }}
                  />
                ) : null}
                {selectedMeasurementData.length > 1 && movingAverageWindow && filteredAverageData.length > 1 ? (
                  <Line
                    data={filteredAverageData}
                    theme={{
                      stroke: {
                        color: palette.primary,
                        width: 2,
                        dashArray: [8, 4],
                      },
                      scatter: {
                        default: {
                          width: 0,
                          height: 0,
                        }
                      }
                    }}
                  />
                ) : null}
                {selectedMeasurementData.length && dotSize ? (
                  <Line
                  data={selectedMeasurementData}
                  theme={{
                    stroke: {
                      width: 0,
                    },
                    scatter: {
                      default: {
                        width: dotSize,
                        height: dotSize,
                        color: palette.primary,
                        rx: dotSize,
                      },
                    }
                  }}
                  hideTooltipOnDragEnd
                  onTooltipSelect={(_, index) => {
                    triggerHaptic('selection');
                    setSelectedDataIndex(index);
                  }}
                  onTooltipSelectEnd={() => {
                    setSelectedDataIndex(-1);
                  }}
                  initialTooltipIndex={selectedMeasurementData.length - 1}
                />
                ) : null}
              </Chart>
              <View style={s.chartTicks} pointerEvents='none'>
                {ticks.map((value) => {
                  const height = 24;
                  const bottom = ((value - verticalMinUnits) / (verticalMaxUnits - verticalMinUnits)) * (300 - 2 * chartPadding) + chartPadding - height / 2;
                  const label = formatValue(value, type);
                  return value !== verticalMaxUnits && (
                    <View key={value} style={{ ...s.chartTick, bottom, height, }}>
                      <View style={{ ...s.chartTickLine, flexGrow: 0, width: 8 }} />
                      <Text style={s.chartTickLabel} variant='bodySmall'>{label}</Text>
                      <View style={s.chartTickLine} />
                    </View>
                  )
                })}
                <View style={{ ...s.chartTick, bottom: (300 - 2 * chartPadding) + chartPadding - 24 / 2, height: 24, }}>
                  <View style={{ ...s.chartTickLine, flexGrow: 0, width: 8 }} />
                  <Text style={s.chartTickLabel} variant='bodySmall'>{formatValue(verticalMaxUnits, type, unit, true)}</Text>
                  <View style={s.chartTickLine} />
                </View>
              </View>
              {selectedDataIndex < 0 ? null : (() => {
                
                const ratio = selectedDateDayOffset / chartDuration;
                const justifyContent = ratio > 0.8 ? 'flex-end' : 'flex-start';
                return (
                  <View style={s.chartSelectionContainer}>
                    <View style={{ ...s.chartSelectionLine, left: (selectedDateDayOffset / chartDuration) * (chartWidth - 2 * chartPadding) + chartPadding - 1 }} />
                    <View style={{ flexGrow: (selectedDateDayOffset / chartDuration) }} />
                    <View style={s.chartSelection}>
                      <View style={{ ...s.chartSelectionRow, justifyContent }}>
                        <Text style={s.chartSelectionLabel} numberOfLines={1} variant='bodyMedium'>
                          {selectedDateString}
                        </Text>
                        <Text style={s.chartSelectionValue} numberOfLines={1} variant='titleSmall'>
                          {selectedDateValueString}
                        </Text>
                      </View>
                      {selectedDateAverageString ? (
                        <View style={{ ...s.chartSelectionRow, justifyContent }}>
                          <Text style={s.chartSelectionLabel} numberOfLines={1} variant='bodyMedium'>
                            {selectedDateAverageLabel}
                          </Text>
                          <Text style={s.chartSelectionValue} numberOfLines={1} variant='titleSmall'>
                            {selectedDateAverageString}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={{ flexGrow: 1 - (selectedDateDayOffset / chartDuration) }} />
                  </View>
                )
              })()}
            </View>
          ) : null}
        </View>
        <View style={{ ...s.cardRow, ...s.chartDurationButtons }}>
          <View style={{ maxWidth: 240, flexGrow: 1 }}>
            {chartTrendlineDropdown}
          </View>
          {chartDurationItems.map(({ title, value }) => {
            const selected = title === chartDurationTitle;
            return (
              <Button
                key={value}
                onPress={() => {
                  setChartDurationTitle(title);
                }}
                mode={'text'}
                textColor={theme.colors.onSurface}
                style={s.durationButton}
                contentStyle={[s.durationButtonContent, selected ? { backgroundColor: palette.backdrop } : {}]}
                compact
              >
                <Text variant='labelLarge'>
                  {title}
                </Text>
              </Button>
            );
          })}
        </View>
      </Surface>
    );
  };

  return (
    <ScrollView style={s.container}>
      <View style={s.cards}>
        <MonthSummaryCard />
        {renderMeasurementChartCard()}
      </View>
    </ScrollView>
  );
}

const createStyles = (theme: MD3Theme, palette?: Palette) => StyleSheet.create({
  container: {
    flex: 1,
  },
  cards: {
    gap: 16,

    paddingVertical: 16,
  },
  cardContainer: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    borderRadius: 12,

    flexGrow: 1,

    backgroundColor: theme.colors.background,
  },
  cardPartial: {
    minWidth: 200,
    width: 'auto',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    flex: 1,
  },
  subheader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 0,
  },
  chart: {
    paddingTop: 52,
    paddingBottom: 24,
  },
  chartTicks: {
    
  },
  chartTick: {
    position: 'absolute',
    width: '100%',
    opacity: 0.4,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chartTickLabel: {
    marginHorizontal: 6,
    color: theme.colors.onSurface,
  },
  chartTickLine: {
    flexGrow: 1,
    borderTopColor: theme.colors.onSurface,
    borderTopWidth: 2,
    height: 0,
    opacity: 0.2,
  },
  chartSelectionContainer: {
    top: 6,
    position: 'absolute',
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
  },
  chartSelection: {
    flexGrow: 0,
    paddingVertical: 4,
    borderRadius: 8,
    flexShrink: 0,
    backgroundColor: theme.colors.surface,
  },
  chartSelectionRow: {
    flexDirection: 'row',
    gap: 4,
  },
  chartSelectionLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  chartSelectionValue: {
    fontSize: 12,
    lineHeight: 16,
  },
  chartSelectionLine: {
    position: 'absolute',
    top: 0,
    height: 352,
    borderLeftColor: palette?.primary || theme.colors.onSurface,
    borderLeftWidth: 2,
    borderEndEndRadius: 4,
    borderEndStartRadius: 4,
    borderStartEndRadius: 4,
    borderStartStartRadius: 4,
  },
  chartDurationButtons: {
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8
  },
  durationButton: {
    borderRadius: 13,
  },
  durationButtonContent: {
    minWidth: 36,
    height: 36,
  },
  durationButtonContentSelected: {
    
  },
});

const MeasurementChartDropdown = ({ label, selectedItem, items, onChange,
}: {
  label: string
  selectedItem: BottomDrawerItem<string> | null
  items: BottomDrawerItem<string>[]
  onChange: (item: { title: string, icon?: string, value: string }) => void
}): JSX.Element => {
  const [isVisible, setIsVisible] = useState(false); 

  const theme = useTheme();
  const { globalPalette } = usePalettes();
  const styles = createDropdownStyles(theme, globalPalette);

  return (
    <BottomDrawer
      title={label}
      anchor={(
        <View style={styles.dropdownButton}>
          <TouchableRipple
            onPress={() => { setIsVisible(true); }}
          >
            <View
              style={styles.dropdownButtonContent}    
            >
              {selectedItem ? (
                <>
                  <Text ellipsizeMode='tail' variant='titleSmall' numberOfLines={1}>
                    {selectedItem.value ? selectedItem.title : `Select ${label.toLocaleLowerCase()}`}
                  </Text>
                </>
              ) : (
                <>
                  <Text variant='labelMedium'>
                    Select {label.toLocaleLowerCase()}
                  </Text>
                  {/* <View style={{ width: 4000, flexShrink: 1 }} /> */}
                </>
              )}
              <Icon source={Icons.down} size={16} />
            </View>
          </TouchableRipple>
        </View>
      )}
      visible={isVisible}
      selectedItem={selectedItem}
      onSelect={(item) => onChange(item)}
      onDismiss={() => setIsVisible(false) }
      items={items}
      palette={globalPalette}
    />
  );
}

const createDropdownStyles = (theme: MD3Theme, palette: Palette) => StyleSheet.create({
  dropdownButton: {
    backgroundColor: palette.backdrop,
    borderRadius: 8,
    overflow: 'hidden',
    flexShrink: 1,
    flexGrow: 1,
    height: 42,
  },
  dropdownButtonContent: {
    flexShrink: 1,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    height: 42,
    paddingHorizontal: 10,
  },
});

type MonthSummaryCardProps = {

};

const MonthSummaryCard = (_: MonthSummaryCardProps) : JSX.Element => {
  const theme = useTheme();
  
  const today = SimpleDate.today();
  const [firstDate, setFirstDate] = useState(new SimpleDate(today.year, today.month, 1));

  const month = firstDate.month;
  const year = firstDate.year;
  const isCurrentMonth = today.month === month && today.year === year;

  const [showOptions, setShowOptions] = useState(false);
  const [includeWeeklyHabits, setIncludeWeeklyHabits] = useState(false);
  const [useRelativeHabits, setUseRelativeHabits] = useState(false);

  const habits = useComputedHabits();
  const measurements = useMeasurements();
  const filteredHabits = habits.filter(({ isWeekly }) => includeWeeklyHabits || !isWeekly);
  const dailyPointTarget = filteredHabits.reduce((previous: number, current: ComputedHabit) => {
    return previous + current.points * (current.isWeekly ? 1 : current.daysPerWeek);
  }, 0) / 7;

  const monthDates = SimpleDate.generateMonth(month, year);

  const monthDatePoints = monthDates.map((monthDate) => {
    if (monthDate.after(today)) return 0;

    const weekDates = SimpleDate.generateWeek(monthDate).slice(0, monthDate.getDayOfWeek() + 1);
    return filteredHabits.reduce((datePoints, habit) => {
      const [complete] = getHabitCompletion(computeHabit(habit, useRelativeHabits ? monthDate : today), measurements, habit.isWeekly ? weekDates : [monthDate]);
      if (!complete) return datePoints;
      if (!habit.isWeekly || monthDate.getDayOfWeek() === 0) return datePoints + habit.points;

      const previousDateWeekDates = weekDates.slice(0, -1);
      const [completePreviousDate] = getHabitCompletion(computeHabit(habit, useRelativeHabits ? monthDate : today), measurements, previousDateWeekDates);
      return datePoints + (completePreviousDate ? 0 : habit.points);
    }, 0);
  });
  const monthTotalPoints = monthDatePoints.reduce((sum, curr) => sum + curr, 0);
  
  const monthDayOffset = firstDate.getDayOfWeek();
  const monthHeatmapData: (number | null)[][] = [0, 1, 2, 3, 4, 5].map((row) => {
    return [0, 1, 2, 3, 4, 5, 6].map((column) => {
      const day = row * 7 + column - monthDayOffset + 1;
      const lastDay = monthDates.length;
      return (day > 0 && day <= lastDay) ? 0 : null;
    });
  }).filter((week) => week.findIndex((day) => day !== null) !== -1);

  monthDates.forEach((date, index) => {
    const points = monthDatePoints[index];
    const dayIndex = date.day + monthDayOffset - 1;

    const row = Math.floor(dayIndex / 7);
    const column = dayIndex % 7;

    monthHeatmapData[row][column] = points;
  });

  const daysThisMonth = (isCurrentMonth ? today.day : monthDates.length);
  const pointsPerDayMonth = monthTotalPoints / daysThisMonth;

  const cardStyles = createStyles(theme);
  const { globalPalette } = usePalettes();
  const styles = createMonthSummaryStyles(theme, globalPalette);

  return (
    <Surface style={cardStyles.cardContainer}>
      <View style={cardStyles.header}>
        <Text style={[cardStyles.title, styles.title]} variant='titleLarge'>{firstDate.toFormattedMonthYear()}</Text>
        <IconButton
          style={styles.headerButton}
          icon={Icons.left}
          size={20}
          onPress={() => {
            setFirstDate(firstDate.getMonthsAgo(1));
          }}
        />
        <IconButton
          style={styles.headerButton}
          icon={Icons.right}
          size={22}
          onPress={() => {
            setFirstDate(firstDate.getMonthsAgo(-1));
          }}
          disabled={today.year === firstDate.year && today.month === firstDate.month}
          />
        <IconButton
          style={{ ...styles.headerButton, backgroundColor: showOptions ? theme.colors.surfaceDisabled : undefined }}
          mode={showOptions ? 'contained-tonal' : undefined}
          iconColor={theme.colors.onSurface}
          icon={Icons.settings}
          onPress={() => setShowOptions(!showOptions)}
        />
      </View>
      <View style={cardStyles.subheader}>
        <View style={styles.pointsPerDay}>
          <Points points={pointsPerDayMonth} size='large' decimals={1} />
          <Text style={styles.pointsPerDayLabel} variant='bodyLarge'> / day</Text>
        </View>
      </View>
      <Heatmap data={monthHeatmapData} target={dailyPointTarget} />
      {showOptions && (
        <View style={styles.options}>
          <View style={styles.toggle}>
            <Text style={styles.toggleLabel} variant='labelMedium'>INCLUDE WEEKLY HABITS</Text>
            <Switch
              value={includeWeeklyHabits}
              onValueChange={(value) => setIncludeWeeklyHabits(value)}
            />
          </View>
          <View style={styles.toggle}>
            <Text style={styles.toggleLabel} variant='labelMedium'>USE RELATIVE HABITS</Text>
            <Switch
              value={useRelativeHabits}
              onValueChange={(value) => setUseRelativeHabits(value)}
            />
          </View>
        </View>
      )}
    </Surface>
  )
};

const createMonthSummaryStyles = (theme: MD3Theme, globalPalette: Palette) => StyleSheet.create({
  title: {
  },
  headerButton: {
    marginVertical: 0,
  },
  pointsPerDay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 15,

    backgroundColor: globalPalette.backdrop,
  },
  pointsPerDayLabel: {

  },
  options: {
    marginTop: 16,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  toggleLabel: {
    
  },
});

export default withAuth(HistoryScreen);