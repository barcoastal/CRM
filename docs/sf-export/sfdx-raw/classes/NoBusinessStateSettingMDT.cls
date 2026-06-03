/**
 * @Description: Class to process the values in No Business State custom metadata.
 */
public inherited sharing class NoBusinessStateSettingMDT {
    private static Map<String, No_Business_State__mdt> noBusinessStateMap = new Map<String, No_Business_State__mdt>();
    /**
     * @description: static block to initialize the No Business State custom metadata to Map
    */
    static {
        noBusinessStateMap.putAll(No_Business_State__mdt.getAll());
    }
    
    /**
     * @description: Method to get the no business states in lower case.
    */
    public static Set<String> getNoBusinessStates() {
        Set<String> noBusinessStatesSet = new Set<String>();
        String noBusinessStates;
        if (!noBusinessStateMap.isEmpty()) {
            noBusinessStates = (String.join(noBusinessStateMap.keySet(),';')).toLowerCase();
            noBusinessStatesSet = new Set<String>(noBusinessStates.split(';'));
        }
        if (Test.isRunningTest()) {
            noBusinessStatesSet = new Set<String> {'washington'};
        }
        return noBusinessStatesSet;
    }
}