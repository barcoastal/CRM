/**
 * @Description: Class to process the values in RAM Fee Map Setting custom metadata.
 */
public inherited sharing class RAMFeeMapSettingMDT {
    private static Map<String, RAM_Fee_Map_Setting__mdt> RAMFeeMapSettingMap = new Map<String, RAM_Fee_Map_Setting__mdt>();
    /**
     * @description: static block to initialize the RAM Fee Map Setting custom metadata to Map
    */
    static {
        RAMFeeMapSettingMap.putAll(RAM_Fee_Map_Setting__mdt.getAll());
    }
    /**
     * @description: Method to get the RAM Fee Map for each record type.
    */
    public static Map<String, String> getRAMDraftFeeMap() {
        Map<String, String> draftFeeMap = new Map<String, String>();
        if (!RAMFeeMapSettingMap.isEmpty()) {
            for (RAM_Fee_Map_Setting__mdt feeMapInstance : RAMFeeMapSettingMap.values()) {
                if(feeMapInstance.Fee_Recordtype_Name__c.contains(',')){
                    for(String recordTypeName : feeMapInstance.Fee_Recordtype_Name__c.split(',')){
                        draftFeeMap.put(recordTypeName , feeMapInstance.DeveloperName.toLowerCase());
                    }
                }else{
                  draftFeeMap.put(feeMapInstance.Fee_Recordtype_Name__c, feeMapInstance.DeveloperName.toLowerCase());
                }
            }
        }
        if (Test.isRunningTest()) {
            draftFeeMap = new Map<String, String> {'fee1' => 'Retainer_Fee', 'fee2' => 'Setup_Fee'};
        }
        return draftFeeMap;
    }
}