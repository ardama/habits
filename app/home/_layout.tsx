import { Redirect, Slot, Tabs, router } from 'expo-router';
import React, { useState, type ReactNode } from 'react';

import { TabBarIcon } from '@c/navigation/TabBarIcon';
import { Colors } from '@u/constants/Colors';
import { useColorScheme } from '@u/hooks/useColorScheme';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BottomNavigation, Icon, Portal, Text, useTheme } from 'react-native-paper';
import { CommonActions } from '@react-navigation/native';
import { withAuth } from '@u/hocs/withAuth';
import Header from '@c/Header';
import { Icons } from '@u/constants/Icons';

const TabLayout = () => {
  const theme = useTheme();

  const renderTabBar = ({ navigation, state, descriptors, insets}: BottomTabBarProps): ReactNode => {
    return (
      <BottomNavigation.Bar
        navigationState={state}
        safeAreaInsets={insets}
        labeled={false}
        activeIndicatorStyle={{ backgroundColor: theme.colors.surfaceDisabled }}
        onTabPress={({ route, preventDefault }) => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (event.defaultPrevented) preventDefault();
          else {
            navigation.dispatch({
              ...CommonActions.navigate(route.name, route.params),
              target: state.key,
            })
          }
        }}
        renderIcon={({ route, focused, color }) => {
          const { options } = descriptors[route.key];
          if (options.tabBarIcon) {
            return options.tabBarIcon({ focused, color, size: 24 });
          }
        }}
        getLabelText={({ route }) => {
          const { options } = descriptors[route.key];
          return options?.title || '';
        }}
      />
    )
  }

  return (
    <Tabs
      screenOptions={{
        header: ({ layout, options, route, navigation }) => {
          const { title } = options
          return (
            <Header showMenuButton title={title || ''} />
          )
        },
      }}
      tabBar={renderTabBar}
      initialRouteName='index'
    >
      <Tabs.Screen
        name="measurements"
        options={{
          title: 'Measurements',
          tabBarIcon: ({ color, focused, size }) => 
            <Icon source={focused ? Icons.measurementFilled : Icons.measurement} color={color} size={size} />
          ,
          headerShown: false,
        }}
        />
      <Tabs.Screen
        name="habits"
        options={{
          title: 'Habits',
          tabBarIcon: ({ color, focused, size }) => 
            <Icon source={focused ? Icons.habitFilled : Icons.habit } color={color} size={size} />
          ,
          headerShown: false,
        }}
        />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Recordings',
          tabBarIcon: ({ color, focused, size }) => (
            <Icon source={focused ? Icons.recordingFilled : Icons.recording} color={color} size={size} />
          ),
          headerShown: false,
        }}
        />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Data',
          tabBarIcon: ({ color, focused, size }) => 
            <Icon source={focused ? Icons.chartFilled : Icons.chart} color={color} size={size} />
          ,
        }}
        />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused, size }) => 
            <Icon source={focused ? Icons.accountFilled : Icons.account} color={color} size={size} />
          ,
          headerShown: false,
        }}
        />
    </Tabs>
  );
}

export default withAuth(TabLayout);