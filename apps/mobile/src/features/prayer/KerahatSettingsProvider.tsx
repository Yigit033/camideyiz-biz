import {createContext,useContext,type PropsWithChildren} from 'react';
import {useKerahatSettings as useStoredKerahatSettings} from './useKerahatSettings';

type KerahatSettingsContextValue=ReturnType<typeof useStoredKerahatSettings>;
const Context=createContext<KerahatSettingsContextValue|null>(null);

/** One preference instance shared between Home and Settings. Navigating back
 * from Settings updates the dial instantly without a second AsyncStorage read.
 */
export function KerahatSettingsProvider({children}:PropsWithChildren){
  const state=useStoredKerahatSettings();
  return <Context.Provider value={state}>{children}</Context.Provider>;
}

export function useKerahatSettings():KerahatSettingsContextValue{
  const value=useContext(Context);
  if(!value)throw new Error('useKerahatSettings must be under KerahatSettingsProvider');
  return value;
}
