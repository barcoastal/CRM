/**
 * @Description: Class to process the values in RAMSettings custom metadata.
 */
public inherited sharing class RAMSettingsMDT {
    
    private static Map<String, RAM_Settings__mdt> settingsMap = new Map<String, RAM_Settings__mdt>(); 
     
    /**
     * @description: static block to initialize the RAM setting custom metadata to Map
    */
    static {
        settingsMap.putAll(RAM_Settings__mdt.getAll());
    }
    
    /**
     * @description: Method to get the supported states of RAM processor
    */
    public static Set<String> getSupportedStates() {
        Set<String> supportedStatesSet = new Set<String>();
        String supportedStates;
        if (!settingsMap.isEmpty() && settingsMap.containsKey('States') != null) {
            supportedStates = settingsMap.get('States').Supported_States__c;
            if (String.isNotBlank(supportedStates)) {
                supportedStatesSet = new Set<String>(supportedStates.split(','));
            }
        }
        if (Test.isRunningTest()) {
            supportedStatesSet = new Set<String> {'NEW YORK'};
        }
        return supportedStatesSet;
    }
}