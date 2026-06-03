public with sharing class ProgramCompletionAlertConfigMDTData {
    private static final integer DEFAULT_THRESHOLD = 6;
    
    public static Integer getThreshold() {
        List<Program_Completion_Alert_Config__mdt> configs = [
            SELECT Pending_Payment_Threshold__c
            FROM Program_Completion_Alert_Config__mdt
            LIMIT 1
        ];
        if (configs.isEmpty()) {
            return DEFAULT_THRESHOLD;
        }
        Decimal val = configs[0].Pending_Payment_Threshold__c;
        return val == null ? DEFAULT_THRESHOLD : val.intValue();
    }
}