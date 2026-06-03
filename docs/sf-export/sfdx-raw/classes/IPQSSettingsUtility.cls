public inherited sharing class IPQSSettingsUtility {
    
    private static Map<String, IPQS_Settings__mdt> settingsMap = new Map<String, IPQS_Settings__mdt>(); 
    
    static {
        settingsMap.putAll(IPQS_Settings__mdt.getAll());
    }

    public static Integer getBatchSize() {
        return (!settingsMap.isEmpty() && settingsMap.get('IPQS_Settings') != null) ? Integer.valueOf(settingsMap.get('IPQS_Settings').Batch_Size__c) : 5; 
    }
}