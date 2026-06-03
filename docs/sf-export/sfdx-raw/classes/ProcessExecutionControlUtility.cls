public inherited sharing class ProcessExecutionControlUtility {
    
    private static Map<String, Process_Execution_Control__mdt> settingsMap = new Map<String, Process_Execution_Control__mdt>(); 
    
    static {
        settingsMap.putAll(Process_Execution_Control__mdt.getAll());
    }

    public static Boolean executeIPQSCheck() {
        return settingsMap.isEmpty() || (settingsMap.get('ProcessExecutionControl') == null ? true : !settingsMap.get('ProcessExecutionControl').Disable_IPQS_Check__c); 
    }
}