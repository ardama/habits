import BottomDrawer, { type BottomDrawerItem } from '@c/BottomDrawer';
import ColorPicker from '@c/ColorPicker';
import Header from '@c/Header';
import OptionButton from '@c/OptionButton';
import { callCreateHabit, callDeleteHabit, callUpdateHabit } from '@s/dataReducer';
import { useCategories, useMeasurements } from '@s/selectors';
import { getHabitOperatorData, getHabitOperatorLabel, habitOperators, type ComputedHabit, type FormHabit, type HabitOperator, type HabitUpdate } from '@t/habits';
import { emptyMeasurement, getMeasurementTypeData, getMeasurementTypeIcon } from '@t/measurements';
import type { BaseColor, Palette } from '@u/colors';
import { EmptyError, NoError } from '@u/constants/Errors';
import { Icons } from '@u/constants/Icons';
import { computeTimeValue, formatValue, parseTimeValue } from '@u/helpers';
import { usePalettes } from '@u/hooks/usePalettes';
import { router } from 'expo-router';
import { Fragment, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, Keyboard } from 'react-native';
import { Button, Dialog, Divider, Icon, IconButton, Portal, Text, TextInput, TouchableRipple, useTheme, type MD3Theme } from 'react-native-paper';
import { useDispatch } from 'react-redux';
import { parseTimeString, formatTimeValue } from '@u/helpers';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';
import { MeasurementLabel, HabitLabel, CategoryBadge } from '@c/Label';

type HabitFormProps = {
  habit: ComputedHabit
  formType: 'create' | 'edit'
}

export default function HabitForm({ habit, formType } : HabitFormProps) {
  const dispatch = useDispatch();
  const measurements = useMeasurements();
  const categories = useCategories();

  const [formHabit, setFormHabit] = useState<FormHabit>({
    ...habit,
    conditions: habit.conditions.length ? habit.conditions.map((condition) => ({
      ...condition,
      target: condition.target?.toString(),
    })) : [{}],
  });

  const [saveAttempted, setSaveAttempted] = useState(false);

  const isNew = formType === 'create';

  const formMeasurementIds = formHabit.conditions?.map(({ measurementId }) => measurementId) || [];
  const formMeasurements = formMeasurementIds.map((id) => measurements.find((measurement) => measurement.id === id));
  
  if (formHabit === null) return;

  const handleFormEdit = (nextHabit: FormHabit) => {
    setFormHabit(nextHabit);
  }

  const handleAddHabit = (newHabit: ComputedHabit) => {
    dispatch(callCreateHabit(newHabit));
  }

  const handleEditHabit = (newHabit: ComputedHabit) => {
    dispatch(callUpdateHabit(newHabit));
  }

  const handleFormClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }

  const handleSave = () => {
    if (hasErrors()) {
      setSaveAttempted(true);
      return;
    }
  
    const nextHabit = {
      ...formHabit,
      name: formHabit.name.trim(),
      category: formHabit.category.trim(),
      daysPerWeek: formHabit.daysPerWeek || 7,
      points: formHabit.points || 1,
      conditions: formHabit.conditions.map((condition) => ({
        measurementId: condition.measurementId || '',
        operator: condition.operator || '>=',
        target: parseFloat(condition.target || '0') || 0,
      })),
    };

    isNew ? handleAddHabit(nextHabit) : handleEditHabit(nextHabit);
    handleFormClose();
  };
  
  const handleCancel = () => {
    handleFormClose();
  }

  const hasErrors = () => {
    if (getNameErrors().hasError) return true;
    if (getConditionErrors().hasError) return true;

    return false
  }

  const getCategoryErrors = () => {
    return NoError;
  }

  const getNameErrors = () => {
    if (!formHabit.name || !formHabit.name.trim()) return EmptyError;
    return NoError;
  }

  const getConditionErrors = () => {
    if (!formHabit.conditions || !formHabit.conditions.length) return EmptyError;
    if (formHabit.conditions.find(({ measurementId, operator, target }) => {
      if (!measurementId || !operator || !target) return true;
      return isNaN(parseFloat(target));
    })) return EmptyError;

    return NoError;
  }

  const theme = useTheme();
  const { getCombinedPalette, getPalette } = usePalettes();
  const palette = getCombinedPalette(formHabit.baseColor);
  const s = createFormStyles(theme, palette);

  const measurementItems: BottomDrawerItem<string>[] = measurements.map((measurement) => ({
    value: measurement.id,
    title: `${measurement.name}${measurement.category ? ` : ${measurement.category}` : ''}`,
    renderItem: () => <MeasurementLabel measurement={measurement} size='large' />,
    icon: getMeasurementTypeIcon(measurement.type),
  }));

  const daysPerWeekItems: BottomDrawerItem<number>[] = [1, 2, 3, 4, 5, 6, 7].map((num) => ({
    value: num,
    title: `${num} day${num === 1 ? '' : 's'} / week`,
  }));

  const pointsItems: BottomDrawerItem<number>[] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => ({
    value: num,
    title: `${num} point${num === 1 ? '' : 's'}`,
  }));

  const [isDialogVisible, setIsDialogVisible] = useState(false);
  const [deletionTarget, setDeletionTarget] = useState<ComputedHabit | null>(null);

  const menuItems: BottomDrawerItem<string>[] = [
    {
      icon: habit.archived ? Icons.show : Icons.hide,
      title: `${habit.archived ? 'Unarchive' : 'Archive'}`,
      subtitle: habit.archived ? 'Restore visibility of this habit.' : 'Hide this habit but preserve its data.',
      value: 'archive',
    },
    {
      icon: Icons.delete,
      title: 'Delete',
      value: 'delete',
      subtitle: 'Permanently delete this habit and all of its data.',
    }
  ];

  const handleDeleteHabit = (habit: ComputedHabit) => {
    setDeletionTarget(habit);
    setIsDialogVisible(true);
  };

  const handleConfirmDeleteHabit = (habit: ComputedHabit | null) => {
    setIsDialogVisible(false);
    setDeletionTarget(null);
    
    setTimeout(() => {
      if (habit) dispatch(callDeleteHabit(habit))
      router.canGoBack() ? router.back() : router.push('/');
    }, 0);
  };

  const handleArchiveHabit = (habit: ComputedHabit, archived: boolean) => {
    const nextHabit = { ...formHabit, archived: archived };
    handleFormEdit(nextHabit);
    dispatch(callUpdateHabit({ ...habit, archived }));
  };

  const [activeTimeConditionIndex, setActiveTimeConditionIndex] = useState<number>(-1);
  const [timeOffsetStrings, setTimeOffsetStrings] = useState<string[]>(() => {
    const initialOffsets: string[] = [];
    formHabit.conditions.forEach((condition, index) => {
      if (condition.target) {
        const { offset } = parseTimeValue(parseFloat(condition.target));
        initialOffsets[index] = offset.toString();
      }
    });
    return initialOffsets;
  });
  const [timeTargetStrings, setTimeTargetStrings] = useState<string[]>(() => {
    const initialConditionTargetStrings: string[] = [];
    formHabit.conditions.forEach((condition, index) => {
      if (condition.target) {
        const { hours } = parseTimeValue(parseFloat(condition.target));
        initialConditionTargetStrings[index] = formatTimeValue(hours);
      }
    });
    return initialConditionTargetStrings;
  });

  const handleTimeChange = (_: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setActiveTimeConditionIndex(-1);
    if (selectedDate && activeTimeConditionIndex >= 0) {
      const hours = selectedDate.getHours() + selectedDate.getMinutes() / 60;
      const offset = parseInt(timeOffsetStrings[activeTimeConditionIndex] || '0') || 0;
      const nextHabit = { ...formHabit };
      nextHabit.conditions[activeTimeConditionIndex].target = computeTimeValue(hours, offset).toString();
      handleFormEdit(nextHabit);
      const nextTimeTargetStrings = [...timeTargetStrings];
      nextTimeTargetStrings[activeTimeConditionIndex] = formatTimeValue(hours);
      setTimeTargetStrings(nextTimeTargetStrings);
    }
  };

  return (
    <>
      <Header
        showBackButton
        title={
          formHabit.name || formHabit.category ?
            <HabitLabel habit={formHabit} size='xlarge' /> :
            isNew ? 'Create habit' : 'Edit habit'
        }
        actionContent={isNew ? null :
          <BottomDrawer
            anchor={
              <Button
                mode='text'
                style={{ borderRadius: 4 }}
                textColor={theme.colors.onSurface}
              >
                MANAGE
              </Button>
            }
            title='Manage'
            items={menuItems}
            onSelect={(item) => {
              if (item.value === 'archive') {
                setTimeout(() => {
                  handleArchiveHabit(habit, !habit.archived);
                }, 200);
              } else {
                handleDeleteHabit(habit);
              }
            }}
            palette={palette}
          />
        }
      />
      <View style={s.container}>
        <ScrollView contentContainerStyle={s.scrollContainer} automaticallyAdjustKeyboardInsets>
          <View style={s.content}>
          <View style={s.formSectionHeader}>
              <Text variant='labelLarge' style={s.labelTitle}>BASIC INFO</Text>
              {isNew && <Text variant='bodyMedium' style={s.labelSubtitle}>
                {`What do you want to call this habit?`}
              </Text>}
            </View>
            <View style={s.formSection}>
              <View style={s.categories}>
                {Array.from(categories).map(({ category, baseColor }) => {
                  const selected = formHabit.category === category && formHabit.baseColor === baseColor;
                  return (
                    <Pressable
                      key={`${category}-${baseColor}`}
                      style={[s.category, selected && { backgroundColor: getPalette(baseColor).backdrop }]}
                      onPress={() => {
                        const nextHabit = { ...formHabit, category, baseColor };
                        handleFormEdit(nextHabit);
                      }}
                    >
                      <CategoryBadge
                        category={category}
                        size='xlarge'
                        baseColor={baseColor}
                      />
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                label='Name'
                placeholder='Early riser, Staying hydrated, etc.'
                placeholderTextColor={theme.colors.onSurfaceDisabled}
                style={s.input}
                mode='outlined'
                value={formHabit.name || ''}
                error={saveAttempted && getNameErrors().hasError}
                onChangeText={(text) => {
                  const nextHabit = { ...formHabit, name: text };
                  handleFormEdit(nextHabit);
                }}
                activeOutlineColor={palette.primary || undefined}
              />
              <TextInput
                label='Category (optional)'
                placeholder='Sleep, Nutrition, etc.'
                placeholderTextColor={theme.colors.onSurfaceDisabled}
                style={s.input}
                mode='outlined'
                value={formHabit.category || ''}
                error={saveAttempted && getCategoryErrors().hasError}
                onChangeText={(text) => {
                  const nextHabit = { ...formHabit, category: text };
                  handleFormEdit(nextHabit);
                }}
                activeOutlineColor={palette.primary || undefined}
              />
              <View>
                <ColorPicker
                  value={formHabit.baseColor}
                  onSelect={(nextColor) => {
                    const nextHabit = { ...formHabit, baseColor: nextColor };
                    handleFormEdit(nextHabit);
                  }}
                />
              </View>
            </View>
            <Divider style={s.formSectionDivider} />
            <View style={s.formSectionHeader}>
              <Text variant='labelLarge' style={s.labelTitle}>FREQUENCY</Text>
              {isNew && <Text variant='bodyMedium' style={s.labelSubtitle}>
                {`Evaluate this habit every day or once per week using weekly measurement totals?`}
              </Text>}
            </View>
            <View style={s.formSection}>
              {(isNew || !formHabit.isWeekly) && <OptionButton
                selected={!formHabit.isWeekly}
                onPress={isNew ?() => {
                  const nextHabit = { ...formHabit, isWeekly: false };
                  handleFormEdit(nextHabit);
                } : undefined}
                icon={Icons.repeatDaily}
                title='DAILY'
                subtitle='Social media time today, hours slept today, etc.'
                palette={palette}                
              />}
              {(isNew || formHabit.isWeekly) && <OptionButton
                selected={formHabit.isWeekly}
                onPress={isNew ? () => {
                  const nextHabit = { ...formHabit, isWeekly: true };
                  handleFormEdit(nextHabit);
                } : undefined}
                icon={Icons.repeatWeekly}
                title='WEEKLY'
                subtitle='Miles ran this week, friends visited this week, etc.'
                palette={palette}
              />}
              {!formHabit.isWeekly && (
                <BottomDrawer
                  title='Frequency target'
                  anchor={(toggleVisibility) => (
                    <Pressable style={s.input} onPress={toggleVisibility}>
                      <TextInput
                        label='Frequency target'
                        mode='outlined'
                        onPress={toggleVisibility}
                        readOnly
                        value={formHabit.isWeekly ? '--' : `${formHabit.daysPerWeek}`}
                        right={<TextInput.Affix text="days / week" />}
                        activeOutlineColor={palette.primary || undefined}
                      />
                    </Pressable>
                  )}
                  items={daysPerWeekItems}
                  selectedItem={daysPerWeekItems.find(({ value }) => value === formHabit.daysPerWeek) || null}
                  onSelect={(item) => {
                    const nextHabit = { ...formHabit, daysPerWeek: item.value };
                    handleFormEdit(nextHabit);
                  }}
                  palette={palette}
                />
              )}
              <View style={s.formRow}>
                <BottomDrawer
                  title='Reward'
                  anchor={(toggleVisibility) => (
                    <Pressable style={s.input} onPress={toggleVisibility}>
                      <TextInput
                        label={'Reward'}
                        mode='outlined'
                        onPress={toggleVisibility}
                        readOnly
                        value={`${formHabit.points}`}
                        right={<TextInput.Affix text="points" />}
                      activeOutlineColor={palette.primary || undefined}
                      />
                    </Pressable>
                  )}
                  items={pointsItems}
                  selectedItem={pointsItems.find(({ value }) => value === formHabit.points) || null}
                  onSelect={(item) => {
                    const nextHabit = { ...formHabit, points: item.value };
                    handleFormEdit(nextHabit);
                  }}
                  showSearchbar={false}
                  palette={palette}
                />
                <Icon source={Icons.points} color={theme.colors.onSurface} size={26} />
              </View>
            </View>
            <Divider style={s.formSectionDivider} />
            <View style={s.formSectionHeader}>
              <Text variant='labelLarge' style={s.labelTitle}>TARGETS</Text>
              {isNew && <Text variant='bodyMedium' style={s.labelSubtitle}>
                {`What measurement targets need to be hit to complete the habit?`}
              </Text>}
            </View>
            <View style={s.formSection}>
              {formHabit.conditions.map((condition, index) => {
                const conditionMeasurement = formMeasurements[index] || emptyMeasurement();

                const typeData = getMeasurementTypeData(conditionMeasurement.type);

                const isDuration = conditionMeasurement.type === 'duration';
                const isBool = conditionMeasurement.type === 'bool';
                const isTime = conditionMeasurement.type === 'time';

                const selectedMeasurementItem = measurementItems.find((item) => item.value === conditionMeasurement.id);
                
                const operatorItems: BottomDrawerItem<string>[] = habitOperators.map((operator) => ({
                  value: operator,
                  icon: getHabitOperatorData(operator).icon,
                  title: getHabitOperatorLabel(operator, conditionMeasurement.type),
                  disabled: isBool && (operator !== '==' && operator !== '!='),
                }));
                const selectedOperatorItem = operatorItems.find(({ value }) => value === condition.operator);
                const suggestedTarget = (conditionMeasurement.initial || 0) + (conditionMeasurement.step || 0);
                const rawValue = parseFloat(condition.target || suggestedTarget.toString());

                const showTargetAffix = !isNaN(rawValue) && (isTime || isDuration);

                return (
                  <Fragment key={index}>
                    {!!index && <Divider style={s.conditionDivider} />}
                    <View style={s.conditionContainer}>
                      <View style={s.condition}>
                        <BottomDrawer<string>
                          title='Measurement'
                          anchor={(
                            <Pressable style={{
                              ...s.dropdownButton,
                              width: condition.measurementId ? 'auto' : '100%',
                              minWidth: 120,
                            }}>
                              <View style={s.dropdownButtonContent}>
                                {condition.measurementId ? (
                                  <MeasurementLabel measurement={conditionMeasurement} size='medium' />
                                ) : (
                                  <>
                                    <Text variant='labelLarge'>
                                      SELECT MEASUREMENT
                                    </Text>
                                    <Icon source={Icons.down} size={16} />
                                  </>
                                )}
                              </View>
                            </Pressable>
                          )}
                          items={measurementItems}
                          selectedItem={selectedMeasurementItem || null}
                          onSelect={(item) => {
                            const nextHabit = { ...formHabit };
                            const selectedMeasurement = measurements.find(({ id }) => id === item.value);
                            nextHabit.conditions[index].measurementId = item.value;
                            if (selectedMeasurement?.type === 'bool') {
                              nextHabit.conditions[index].operator = '==';
                              nextHabit.conditions[index].target = '1';
                            } else {
                              nextHabit.conditions[index].target = '';
                            }
          
                            handleFormEdit(nextHabit);
                          }}
                          palette={palette}
                        />
                        <View style={{ flexDirection: 'row', gap: 8, flexGrow: 1, flexShrink: 1 }}>
                          {!!condition.measurementId && <BottomDrawer<string>
                            title='Operator'
                            anchor={
                              <Pressable style={{
                                ...s.dropdownButton,
                                flexGrow: condition.operator ? 0 : 1,
                                flexShrink: condition.operator ? 0 : 0,
                              }}>
                                <View style={s.dropdownButtonContent}>
                                  {condition.operator ? (
                                    <Icon source={getHabitOperatorData(condition.operator).icon} size={16} />
                                  ) : (
                                    <>
                                      <Text variant='labelLarge'>
                                        SELECT OPERATOR
                                      </Text>
                                      <Icon source={Icons.down} size={16} />
                                    </>
                                  )}
                                </View>
                              </Pressable>
                            }
                            items={operatorItems}
                            selectedItem={selectedOperatorItem || null}
                            onSelect={(item) => {
                              const nextHabit = { ...formHabit };
                              nextHabit.conditions[index].operator = item.value as HabitOperator;
                              handleFormEdit(nextHabit);
                            }}
                            palette={palette}
                          />}
                          {!!condition.measurementId && !!condition.operator && 
                            <>
                              {isTime ? (
                                <>
                                  <TextInput
                                    mode='outlined'
                                    style={[s.targetInput, { minWidth: 100 }]}
                                    contentStyle={s.targetInputContent}
                                    label='Target value'
                                    placeholder={formatTimeValue(suggestedTarget)}
                                    placeholderTextColor={theme.colors.onSurfaceDisabled}
                                    dense
                                    readOnly={Platform.OS === 'ios'}
                                    error={saveAttempted && getConditionErrors().hasError}
                                    value={timeTargetStrings[index] || ''}
                                    onFocus={() => {
                                      setActiveTimeConditionIndex(index);
                                    }}
                                    onPress={() => {
                                      if (activeTimeConditionIndex === index) setActiveTimeConditionIndex(-1);
                                      else setActiveTimeConditionIndex(index);
                                    }}
                                    onChangeText={(text) => {
                                      if (Platform.OS !== 'web') return;

                                      const nextTimeTargetStrings = [...timeTargetStrings];
                                      nextTimeTargetStrings[index] = text;
                                      setTimeTargetStrings(nextTimeTargetStrings);

                                      const parsedTime = parseTimeString(text);
                                      const offset = parseInt(timeOffsetStrings[index] || '0') || 0;
                                      const nextHabit = { ...formHabit };
                                      const nextTarget = parsedTime ? computeTimeValue(parsedTime.hours, offset).toString() : '';
                                      nextHabit.conditions[index].target = nextTarget;
                                      handleFormEdit(nextHabit);
                                    }}
                                    onBlur={() => {
                                      setActiveTimeConditionIndex(-1);
                                      if (Platform.OS !== 'web') {
                                        return;
                                      }

                                      const parsedTime = parseTimeString(timeTargetStrings[index] || '');
                                      const offset = parseInt(timeOffsetStrings[index] || '0') || 0;
                                      const nextHabit = { ...formHabit };
                                      const nextTarget = parsedTime ? computeTimeValue(parsedTime.hours, offset).toString() : '';
                                      nextHabit.conditions[index].target = nextTarget;
                                      handleFormEdit(nextHabit);
                                      const nextTimeTargetStrings = [...timeTargetStrings];
                                      nextTimeTargetStrings[index] = parsedTime ? formatTimeValue(parsedTime.hours) : '';
                                      setTimeTargetStrings(nextTimeTargetStrings);
                                    }}
                                    activeOutlineColor={palette.primary || undefined}
                                    showSoftInputOnFocus={Platform.OS === 'web'}
                                  />
                                  <TextInput
                                    style={[s.targetInput, { minWidth: 100, width: 100 }]}
                                    mode='outlined'
                                    label='Offset'
                                    value={timeOffsetStrings[index] || '0'}
                                    error={saveAttempted && getConditionErrors().hasError}
                                    activeOutlineColor={palette.primary || undefined}
                                    keyboardType="numeric"
                                    right={
                                      <TextInput.Affix text={`days`} />
                                    }
                                    onChangeText={(text) => {
                                      const nextTimeOffsetStrings = [...timeOffsetStrings];
                                      nextTimeOffsetStrings[index] = text;
                                      setTimeOffsetStrings(nextTimeOffsetStrings);
                                      
                                      const offset = parseInt(text) || 0;
                                      const { hours } = parseTimeValue(parseFloat(condition.target || '12'));
                                      const nextHabit = { ...formHabit };
                                      nextHabit.conditions[index].target = computeTimeValue(hours, offset).toString();
                                      handleFormEdit(nextHabit);
                                    }}
                                    onBlur={() => {
                                      const offset = parseInt(timeOffsetStrings[index] || '0') || 0;
                                      const nextTimeOffsetStrings = [...timeOffsetStrings];
                                      nextTimeOffsetStrings[index] = offset.toString();
                                      setTimeOffsetStrings(nextTimeOffsetStrings);

                                      const { hours } = parseTimeValue(parseFloat(condition.target || '12'));
                                      const nextHabit = { ...formHabit };
                                      nextHabit.conditions[index].target = computeTimeValue(hours, offset).toString();
                                      handleFormEdit(nextHabit);
                                    }}
                                  />
                                </>
                              ) : (
                                <TextInput
                                  mode='outlined'
                                  style={s.targetInput}
                                  contentStyle={s.targetInputContent}
                                  label='Target value'
                                  placeholder={suggestedTarget.toString()}
                                  placeholderTextColor={theme.colors.onSurfaceDisabled}
                                  dense
                                  error={saveAttempted && getConditionErrors().hasError}
                                  value={isBool ? 'Yes' : condition.target || ''}
                                  onChangeText={(text) => {
                                    const nextHabit = { ...formHabit };
                                    nextHabit.conditions[index].target = text;
                                    handleFormEdit(nextHabit);
                                  }}
                                  right={(
                                    <TextInput.Affix
                                      text={showTargetAffix ? `(${formatValue(rawValue, conditionMeasurement.type)})` : (conditionMeasurement.unit || '')}
                                    />
                                  )}
                                  keyboardType="numeric"
                                  disabled={isBool}
                                  activeOutlineColor={palette.primary || undefined}
                                />
                              )}
                            </>
                          }
                        </View>
                        {Platform.OS === 'ios' && activeTimeConditionIndex === index && (
                          <View style={{ width: '100%', flexShrink: 0, marginVertical: -8 }}>
                            <DateTimePicker
                              value={new Date(
                                2000, 0, 1,
                                parseInt(condition.target || '12'),
                                Math.round((parseFloat(condition.target || '12') % 1) * 60),
                              )}
                              mode="time"
                              onChange={handleTimeChange}
                              display="spinner"
                              minuteInterval={1}
                              textColor={palette.primary}
                            />
                          </View>
                        )}
                      </View>
                      {formHabit.conditions.length > 1 && (
                        <IconButton
                          icon={Icons.delete}
                          style={s.deleteButton}
                          size={20}
                          onPress={() => {
                            const nextHabit = { ...formHabit };
                            nextHabit.conditions.splice(index, 1);
                            handleFormEdit(nextHabit);

                            const nextTimeTargetStrings = [...timeTargetStrings];
                            nextTimeTargetStrings.splice(index, 1);
                            setTimeTargetStrings(nextTimeTargetStrings);
                            const nextTimeOffsets = [...timeOffsetStrings];
                            nextTimeOffsets.splice(index, 1);
                            setTimeOffsetStrings(nextTimeOffsets);
                          }}
                        />
                      )}
                    </View>
                  </Fragment>
                )
              })}
              <Button
                style={s.addConditionButton}
                labelStyle={s.addConditionButtonLabel}
                mode='text'
                onPress={() => {
                  const nextHabit = { ...formHabit };

                  nextHabit.conditions.push({});
                  setTimeTargetStrings([...timeTargetStrings, '']);
                  setTimeOffsetStrings([...timeOffsetStrings, '0']);
                  handleFormEdit(nextHabit);
                }}
                textColor={theme.colors.onSurface}
                buttonColor={palette.backdrop}
                compact
              >
                <View style={s.addConditionButtonContent}>
                  <Icon source={Icons.add} size={14} color={theme.colors.onSurface} />
                  <Text variant='labelLarge'>
                    ADD TARGET
                  </Text>
                </View>
              </Button>
            </View>
            {formHabit.conditions.length > 1 && (
              <>
                <Divider style={s.formSectionDivider} />
                <View style={s.formSectionHeader}>
                  <Text variant='labelLarge' style={s.labelTitle}>MULTI TARGET</Text>
                  {isNew && <Text variant='bodyMedium' style={s.labelSubtitle}>
                    {`Do all targets need to be hit or just one?`}
                  </Text>}
                </View>
                <View style={s.formSection}>
                  <OptionButton
                    selected={formHabit.predicate === 'AND'}
                    onPress={() => {
                      const nextHabit = { ...formHabit, predicate: 'AND' };
                      handleFormEdit(nextHabit);
                    }}
                    icon={Icons.predicateAnd}
                    title='ALL'
                    subtitle='Every target must be hit.'
                    palette={palette}
                  />
                  <OptionButton
                    selected={formHabit.predicate === 'OR'}
                    onPress={() => {
                      const nextHabit = { ...formHabit, predicate: 'OR' };
                      handleFormEdit(nextHabit);
                    }}
                    icon={Icons.predicateOr}
                    title='ANY'
                    subtitle='One or more targets must be hit.'
                    palette={palette}
                  />
                </View>
              </>
            )}
          </View>
        </ScrollView>
        <View style={s.buttons}>
          <Button
            mode="text"
            style={[s.button, s.cancelButton]}
            contentStyle={[s.buttonContent, s.cancelButtonContent]}
            labelStyle={s.buttonLabel}
            onPress={() => handleCancel()}
            textColor={theme.colors.onSurface}
          >
            <Text variant='labelLarge' style={[s.buttonText, s.cancelButtonText]}>{isNew ? 'Discard' : 'Cancel'}</Text>
          </Button>
          <Button
            mode="text"
            style={s.button}
            contentStyle={s.buttonContent}
            labelStyle={s.buttonLabel}
            onPress={() => handleSave()}
            textColor={palette.primary}
            disabled={saveAttempted && hasErrors()}
          >
            <Text variant='labelLarge' style={[s.buttonText, saveAttempted && hasErrors() ? { color: theme.colors.onSurfaceDisabled } : {}]}>
              {isNew ? 'Create' : 'Save'}
            </Text>
          </Button>
        </View>
      </View>
      {Platform.OS === 'android' && activeTimeConditionIndex >= 0 && (
        <DateTimePicker
          value={new Date(
            2000, 0, 1,
            parseInt(formHabit.conditions[activeTimeConditionIndex].target || '12'),
            Math.round((parseFloat(formHabit.conditions[activeTimeConditionIndex].target || '12') % 1) * 60)
          )}
          mode="time"
          onChange={handleTimeChange}
          display="spinner"
          minuteInterval={1}
          textColor={palette.primary}
        />
      )}
      <Portal>
        <Dialog
          visible={isDialogVisible}
          onDismiss={() => setIsDialogVisible(false) }
          dismissable
        >
          <Dialog.Title>Delete Habit</Dialog.Title>
          <Dialog.Content>
            <Text variant='bodyMedium'>
              Are you sure you want to delete this habit? This action cannot be undone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              contentStyle={s.dialogButton}
              onPress={() => setIsDialogVisible(false)}
              mode='text'
              textColor={theme.colors.onSurface}
            >
              CANCEL
            </Button>
            <Button
              contentStyle={s.dialogButton}  
              onPress={() => handleConfirmDeleteHabit(deletionTarget)}
              mode='text'
              textColor={theme.colors.error}
            >
              DELETE
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}


const createFormStyles = (theme: MD3Theme, palette: Palette) => StyleSheet.create({
  container: {
    width: '100%',
    flexGrow: 1,
    flexShrink: 1,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 72,
  },
  scrollContainer: {
    paddingVertical: 16,
    width: '100%',
    backgroundColor: theme.colors.background,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  content: {
    flexGrow: 1,
    flexShrink: 1,
    maxWidth: 600,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  formSectionHeader: {
    gap: 4,
    marginBottom: 12,
  },
  labelTitle: {
    
  },
  labelSubtitle: {
    
  },
  formSectionDivider: {
    backgroundColor: theme.colors.surfaceDisabled,
    marginVertical: 32,
  },
  formSection: {
    gap: 12,
  },
  formRow: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    flexGrow: 1,
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  category: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  conditionContainer: {
    flexDirection: 'row',
    flexGrow: 1,
    flexShrink: 1,
    maxWidth: '100%',
    alignItems: 'flex-start',
    gap: 8,
    marginVertical: 4,
  },
  condition: {
    flexDirection: 'row',
    flexGrow: 1,
    flexShrink: 1,
    maxWidth: '100%',
    flexWrap: 'wrap',
    gap: 8,
    rowGap: 10,
    marginTop: -6,
  },
  conditionDivider: {
    backgroundColor: theme.colors.surfaceDisabled,
    marginVertical: 4,
    marginHorizontal: 32,
  },
  dropdownButton: {
    borderRadius: 4,
    overflow: 'hidden',
    flexShrink: 1,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    height: 42,
    marginTop: 6,
  },
  dropdownButtonContent: {
    flexShrink: 1,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    paddingHorizontal: 10,
  },
  measurementActivity: {
    flexShrink: 4,
  },
  measurementVariant: {
    color: theme.colors.onSurface,
    flexShrink: 1,
  },
  targetInput: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 120,
    width: 120,
    padding: 0,
    height: 40,
  },
  targetInputContent: {
    margin: 0,
    padding: 0,
  },
  addConditionButton: {
    marginTop: 12,
    borderRadius: 4,
  },
  addConditionButtonLabel: {
  },
  addConditionButtonContent: {
    height: 20,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  predicateButtons: {
    
  },
  predicateButton: {
    
  },
  predicateButtonLabel: {
    
  },
  deleteButton: {
    margin: 0,
    height: 42,
    width: 42,
    borderRadius: 4,
  },
  buttons: {
    width: '100%',
    position: 'absolute',
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: theme.colors.elevation.level2,
  },
  button: {
    flexGrow: 1,
    borderRadius: 0,
  },
  buttonContent: {
    height: 72,
    
  },
  buttonLabel: {
    borderRadius: 0,
  },
  buttonText: {
    fontSize: 16,
    color: palette.primary,
  },
  cancelButton: {

  },
  cancelButtonContent: {
  },
  cancelButtonText: {
    color: theme.colors.onSurface,
  },
  dialogButton: {
    paddingHorizontal: 8,
  }
});