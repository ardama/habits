import BottomDrawer, { type BottomDrawerItem } from '@c/BottomDrawer';
import OptionButton from '@c/OptionButton';
import { callCreateHabit, callUpdateHabit } from '@s/dataReducer';
import { useMeasurements } from '@s/selectors';
import { getHabitOperatorData, getHabitOperatorLabel, getHabitPredicateIcon, habitOperators, type ComputedHabit, type HabitOperator, type HabitUpdate } from '@t/habits';
import { createMeasurement, emptyMeasurement, getMeasurementTypeData, getMeasurementTypeIcon, type Measurement } from '@t/measurements';
import { EmptyError, NoError } from '@u/constants/Errors';
import { Icons } from '@u/constants/Icons';
import { formatValue } from '@u/helpers';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Divider, Icon, IconButton, Menu, SegmentedButtons, Text, TextInput, TouchableRipple, useTheme, type MD3Theme } from 'react-native-paper';
import { useDispatch } from 'react-redux';

type FormHabit = {
  id: string;
  userId: string;
  updates: HabitUpdate[],
  
  name: string;
  isWeekly: boolean;
  points: number;
  daysPerWeek: number;
  archived: boolean;
  conditions: FormHabitCondition[],
  predicate: string,
  priority: number,
};

type FormHabitCondition = {
  measurementId?: string;
  operator?: HabitOperator;
  target?: string;
}

type HabitFormProps = {
  habit: ComputedHabit,
  formType: 'create' | 'edit',
}

export default function HabitForm({ habit, formType } : HabitFormProps) {
  const dispatch = useDispatch();
  const measurements = useMeasurements();

  const [formHabit, setFormHabit] = useState<FormHabit>({
    ...habit,
    conditions: (habit.conditions || []).map((condition) => ({
      ...condition,
      target: condition.target?.toString(),
    })),
  });

  const [saveAttempted, setSaveAttempted] = useState(false);
  const [measurementMenuVisibilities, setMeasurementMenuVisibilities] = useState<boolean[]>([]);
  const [operatorMenuVisibilities, setOperatorMenuVisibilities] = useState<boolean[]>([]);
  const [isDaysPerWeekMenuVisible, setIsDaysPerWeekMenuVisible] = useState(false);
  const [isPointsMenuVisible, setIsPointsMenuVisible] = useState(false);

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
    handleFormClose()
  }

  const hasErrors = () => {
    if (getNameErrors().hasError) return true;
    if (getTargetErrors().hasError) return true;
    return false
  }

  const getNameErrors = () => {
    if (!formHabit.name || !formHabit.name.trim()) return EmptyError;
    return NoError;
  }

  const getTargetErrors = () => {

    // if (isBool) return NoError;
    // if (formHabit.conditions.find(({ target }) => !target)) return EmptyError;

    // if (formHabit.conditions.find((condition) => {
    //   const target = parseFloat(condition.target);
    //   return (isNaN(target) || !isFinite(target) || target < 0);
    // })) {
    //   return Error('Invalid target');
    // }

    return NoError;
  }

  const theme = useTheme();
  const s = createFormStyles(theme);

  const measurementItems: BottomDrawerItem<string>[] = measurements.map((measurement) => ({
    value: measurement.id,
    title: `${measurement.name}${measurement.variant ? ` : ${measurement.variant}` : ''}`,
    icon: getMeasurementTypeIcon(measurement.type),
  }));

  const daysPerWeekItems: BottomDrawerItem<number>[] = [1, 2, 3, 4, 5, 6, 7].map((num) => ({
    value: num,
    title: `${num}`,
  }));

  const pointsItems: BottomDrawerItem<number>[] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => ({
    value: num,
    title: `${num}`,
  }));

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scrollContainer}>
        <View style={s.content}>
          <View style={s.formSectionHeader}>
            <Text variant='labelMedium' style={s.labelTitle}>FREQUENCY</Text>
            <Text variant='bodySmall' style={s.labelSubtitle}>
              {`${isNew ? 'Choose h' : 'H'}ow often this habit is evaluated.`}
            </Text>
          </View>
          <View style={s.formSection}>
            <OptionButton
              selected={!formHabit.isWeekly}
              onPress={() => {
                const nextHabit = { ...formHabit, isWeekly: false };
                handleFormEdit(nextHabit);
              }}
              icon={Icons.repeatDaily}
              title='DAILY'
              subtitle='Evaluated daily based on the measurement values for each day.'
              disabled={!isNew && formHabit.isWeekly}
            />
            <OptionButton
              selected={formHabit.isWeekly}
              onPress={() => {
                const nextHabit = { ...formHabit, isWeekly: true };
                handleFormEdit(nextHabit);
              }}
              icon={Icons.repeatWeekly}
              title='WEEKLY'
              subtitle='Evaluated weekly based on all measurement values from the week.'
              disabled={!isNew && !formHabit.isWeekly}
            />
            {!formHabit.isWeekly && (
              <BottomDrawer
                visible={isDaysPerWeekMenuVisible}
                onDismiss={() => setIsDaysPerWeekMenuVisible(false)}
                anchor={
                  <Pressable onPress={() => { setIsDaysPerWeekMenuVisible(true); }} disabled={formHabit.isWeekly}>
                    <TextInput
                      label='Frequency'
                      mode='outlined'
                      style={s.input}
                      readOnly
                      value={formHabit.isWeekly ? '--' : `${formHabit.daysPerWeek}`}
                      right={<TextInput.Affix text="times / week" />}
                      disabled={formHabit.isWeekly}
                    />
                  </Pressable>
                }
                items={daysPerWeekItems}
                selectedItem={daysPerWeekItems.find(({ value }) => value === formHabit.daysPerWeek) || null}
                onSelect={(item) => {
                  const nextHabit = { ...formHabit, daysPerWeek: item.value };
                  handleFormEdit(nextHabit);
                  
                  setIsDaysPerWeekMenuVisible(false);
                }}
              />
            )}
          </View>
          <Divider style={s.formSectionDivider} />
          <View style={s.formSectionHeader}>
            <Text variant='labelMedium' style={s.labelTitle}>BASIC INFO</Text>
            <Text variant='bodySmall' style={s.labelSubtitle}>
              {`Set the basic attributes of the habit.`}
            </Text>
          </View>
          <View style={s.formSection}>
            <TextInput
              label='Name'
              placeholder='Early riser, Staying hydrated'
              placeholderTextColor={theme.colors.onSurfaceDisabled}
              style={s.input}
              mode='outlined'
              value={formHabit.name || ''}
              error={saveAttempted && getNameErrors().hasError}
              onChangeText={(text) => {
                const nextHabit = { ...formHabit, name: text };
                handleFormEdit(nextHabit);
              }}
            />
            <View style={s.formRow}>
              <BottomDrawer
                visible={isPointsMenuVisible}
                onDismiss={() => setIsPointsMenuVisible(false)}
                anchor={
                  <Pressable style={s.input} onPress={() => { setIsPointsMenuVisible(true); }}>
                    <TextInput
                      label={'Reward'}
                      mode='outlined'
                      readOnly
                      value={`${formHabit.points}`}
                      right={<TextInput.Affix text="points" />}
                    />
                  </Pressable>
                }
                items={pointsItems}
                selectedItem={pointsItems.find(({ value }) => value === formHabit.points) || null}
                onSelect={(item) => {
                  const nextHabit = { ...formHabit, points: item.value };
                  handleFormEdit(nextHabit);
                  
                  setIsPointsMenuVisible(false);
                }}
                showSearchbar={false}
              />
              <Icon source={Icons.points} color={theme.colors.onSurface} size={26} />
            </View>
          </View>
          <Divider style={s.formSectionDivider} />
          <View style={s.formSectionHeader}>
            <Text variant='labelMedium' style={s.labelTitle}>MEASUREMENTS</Text>
            <Text variant='bodySmall' style={s.labelSubtitle}>
              {`Configure the measurement targets that need to be hit to consider this habit completed.`}
            </Text>
          </View>
          <View style={s.formSection}>
            {formHabit.conditions.map((condition, index) => {
              const conditionMeasurement = formMeasurements[index] || emptyMeasurement();

              const typeData = getMeasurementTypeData(conditionMeasurement.type);

              const isDuration = conditionMeasurement.type === 'duration';
              const isBool = conditionMeasurement.type === 'bool';
              const isTime = conditionMeasurement.type === 'time';
              const isMeasurementMenuVisible = measurementMenuVisibilities[index];
              const isOperatorMenuVisible = operatorMenuVisibilities[index];

              const selectedMeasurementItem = measurementItems.find((item) => item.value === conditionMeasurement.id);
              
              const operatorItems: BottomDrawerItem<string>[] = habitOperators.map((operator) => ({
                value: operator,
                icon: getHabitOperatorData(operator).icon,
                title: getHabitOperatorLabel(operator, conditionMeasurement.type),
                disabled: isBool && (operator !== '==' && operator !== '!='),
              }));
              const selectedOperatorItem = operatorItems.find(({ value }) => value === condition.operator);
              const suggestedTarget = conditionMeasurement.initial + conditionMeasurement.step;

              return (
                <View key={index} style={s.condition}>
                  <BottomDrawer<string>
                    anchor={(
                      <View style={{
                        ...s.dropdownButton,
                        flexGrow: condition.measurementId ? 0 : 1,
                      }}>
                        <TouchableRipple
                          onPress={() => {
                            const nextVisibilities = [...measurementMenuVisibilities];
                            nextVisibilities[index] = true;
                            setMeasurementMenuVisibilities(nextVisibilities);
                          }}
                        >
                          <View style={s.dropdownButtonContent}>
                            {condition.measurementId ? (
                              <>
                                <Icon source={typeData.icon} size={16} />
                                <Text ellipsizeMode='tail' variant='titleSmall' numberOfLines={1} style={s.measurementActivity}>
                                  {conditionMeasurement.name}
                                </Text>
                                {conditionMeasurement.variant ? (
                                  <>
                                    <Text numberOfLines={1} variant='bodyMedium'>:</Text>
                                    <Text ellipsizeMode='tail' numberOfLines={1} variant='bodyMedium' style={s.measurementVariant}>
                                      {conditionMeasurement.variant}
                                    </Text>
                                  </>
                                ) : null}
                              </>
                            ) : (
                              <>
                                <Text variant='labelMedium'>
                                  Choose measurement
                                </Text>
                                {/* <View style={{ width: 4000, flexShrink: 1 }} /> */}
                                <Icon source={Icons.down} size={16} />
                              </>
                            )}
                          </View>
                        </TouchableRipple>
                      </View>
                    )}
                    items={measurementItems}
                    selectedItem={selectedMeasurementItem || null}
                    onDismiss={() => {
                      const nextVisibilities = [...measurementMenuVisibilities];
                      nextVisibilities[index] = false;
                      setMeasurementMenuVisibilities(nextVisibilities);
                    }}
                    onSelect={(item) => {
                      const nextHabit = { ...formHabit };
                      const selectedMeasurement = measurements.find(({ id }) => id === item.value);
                      nextHabit.conditions[index].measurementId = item.value;
                      if (selectedMeasurement?.type === 'bool') {
                        nextHabit.conditions[index].operator = '==';
                        nextHabit.conditions[index].target = '1';
                      }
    
                      handleFormEdit(nextHabit);
                      const nextVisibilities = [...measurementMenuVisibilities];
                      nextVisibilities[index] = false;
                      setMeasurementMenuVisibilities(nextVisibilities);
                    }}
                    visible={isMeasurementMenuVisible}
                  />
                  {condition.measurementId && <BottomDrawer<string>
                    anchor={
                      <View style={{
                        ...s.dropdownButton,
                        flexGrow: condition.operator ? 0 : 1,
                        flexShrink: condition.operator ? 0 : 1,
                      }}>
                        <TouchableRipple
                          onPress={() => {
                            const nextVisibilities = [...operatorMenuVisibilities];
                            nextVisibilities[index] = true;
                            setOperatorMenuVisibilities(nextVisibilities);
                          }}
                          disabled={!condition.measurementId}
                        >
                          <View style={s.dropdownButtonContent}>
                            {
                              condition.operator ? (
                                <Icon source={getHabitOperatorData(condition.operator).icon} size={14} />
                              ) : (
                                  <>
                                <Text variant='labelMedium' ellipsizeMode='tail' numberOfLines={1} style={{ color: !condition.measurementId ? theme.colors.onSurfaceDisabled : undefined}}>
                                  Choose operator
                                </Text>
                                <Icon source={Icons.down} size={16} color={!condition.measurementId ? theme.colors.onSurfaceDisabled : undefined} />
                                </>
                              )
                            }
                          </View>
                        </TouchableRipple>
                      </View>
                    }
                    visible={isOperatorMenuVisible}
                    onDismiss={() => {
                      const nextVisibilities = [...operatorMenuVisibilities];
                      nextVisibilities[index] = false;
                      setOperatorMenuVisibilities(nextVisibilities);
                    }}
                    items={operatorItems}
                    selectedItem={selectedOperatorItem || null}
                    onSelect={(item) => {
                      const nextHabit = { ...formHabit };
                      nextHabit.conditions[index].operator = item.value as HabitOperator;
                      handleFormEdit(nextHabit);
                      
                      const nextVisibilities = [...operatorMenuVisibilities];
                      nextVisibilities[index] = false;
                      setOperatorMenuVisibilities(nextVisibilities);
                    }}
                  />}
                  {condition.measurementId && condition.operator && 
                    <TextInput
                      mode='outlined'
                      style={{ ...s.targetInput, marginTop: -5}}
                      contentStyle={s.targetInputContent}
                      label='Target'
                      placeholder={suggestedTarget.toString()}
                      placeholderTextColor={theme.colors.onSurfaceDisabled}
                      dense
                      error={saveAttempted && getTargetErrors().hasError}
                      value={isBool ? 'Yes' : condition.target}
                      onChangeText={(text) => {
                        const nextHabit = { ...formHabit };
                        nextHabit.conditions[index].target = text;
                        handleFormEdit(nextHabit);
                      }}
                      right={(
                        <TextInput.Affix
                          text={isTime || isDuration ? `(${formatValue(parseFloat(condition.target || suggestedTarget.toString()), conditionMeasurement.type)})` : (conditionMeasurement.unit || '')}
                        />
                      )}
                      keyboardType="numeric"
                      disabled={isBool}
                    />
                  }
                  {formHabit.conditions.length > 1 ? (
                    <IconButton
                      icon={'delete-outline'}
                      style={s.deleteButton}
                      size={20}
                      onPress={() => {
                        const nextHabit = { ...formHabit };
                        nextHabit.conditions.splice(index, 1);
                        handleFormEdit(nextHabit);
                      }}
                    />
                  ) : null}
                </View>
              )
            })}
            <Button
              style={s.addConditionButton}
              labelStyle={s.addConditionButtonLabel}
              mode='text'
              onPress={() => {
                const nextHabit = { ...formHabit };

                nextHabit.conditions.push({});
                handleFormEdit(nextHabit);
              }}
              textColor={theme.colors.onSurface}
              buttonColor={theme.colors.surfaceDisabled}
              compact
            >
              <View style={s.addConditionButtonContent}>
                <Icon source={'plus'} size={14} color={theme.colors.onSurface} />
                <Text variant='labelMedium'>
                  ADD CONDITION
                </Text>
              </View>
            </Button>
          </View>
          {formHabit.conditions.length > 1 && (
            <>
              <Divider style={s.formSectionDivider} />
              <View style={s.formSectionHeader}>
                <Text variant='labelMedium' style={s.labelTitle}>MULTI CONDITION</Text>
                <Text variant='bodySmall' style={s.labelSubtitle}>
                  {`Define how many conditions need to be satisfied to consider the habit completed.`}
                </Text>
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
                  subtitle='Every condition must be satisfied.'
                  />
                <OptionButton
                  selected={formHabit.predicate === 'OR'}
                  onPress={() => {
                    const nextHabit = { ...formHabit, predicate: 'OR' };
                    handleFormEdit(nextHabit);
                  }}
                  icon={Icons.predicateOr}
                  title='ANY'
                  subtitle='At least one condition must be satisfied.'
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
        >
          <Text variant='labelLarge' style={[s.buttonText, s.cancelButtonText]}>Discard</Text>
        </Button>
        <Button
          mode="text"
          style={s.button}
          contentStyle={s.buttonContent}
          labelStyle={s.buttonLabel}
          onPress={() => handleSave()}
        >
          <Text variant='labelLarge' style={s.buttonText}>{isNew ? 'Create' : 'Save'}</Text>
        </Button>
      </View>
    </View>
  );
}


const createFormStyles = (theme: MD3Theme) => StyleSheet.create({
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
    paddingVertical: 24,
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
  optionSelection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  optionSelectionText: {
    flexShrink: 1,
  },
  scopeIcon: {
  },
  condition: {
    flexDirection: 'row',
    flexGrow: 1,
    flexShrink: 1,
    maxWidth: '100%',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  dropdownButton: {
    backgroundColor: theme.colors.surfaceDisabled,
    borderRadius: 4,
    overflow: 'hidden',
    flexShrink: 1,
    flexGrow: 1,
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
  measurementActivity: {
    flexShrink: 4,
  },
  measurementVariant: {
    color: theme.colors.onSurface,
    flexShrink: 1,
  },
  targetInput: {
    flex: 1,
    minWidth: 120,
    padding: 0,
    height: 40,
  },
  targetInputContent: {
    margin: 0,
    padding: 0,
  },
  addConditionButton: {
    marginTop: 12,
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
  },
  buttons: {
    width: '100%',
    position: 'absolute',
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderColor: theme.colors.surfaceVariant,
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
    color: theme.colors.onSurface,
  },
  cancelButton: {

  },
  cancelButtonContent: {
    borderRightWidth: 1,
    borderColor: theme.colors.surfaceVariant,
  },
  cancelButtonText: {
    color: theme.colors.onSurface,
  },
});