/**
 * @Description: Utility class to process the SAS mapping custom metadata.
 */
public with sharing class SASUtility {
    
    /**
     * @description: Method to query and form mapping between SAS field and callout data item field.
     * @param methodName - SAS callout method name to get the mapping based on the method.
     * @return Map of SAS field and Callout Data Item field
     */
    public static Map<String, String> formSASwithCDIFieldMapping(String methodName) {

        Map<String, String> sasToCDIFieldMap = new Map<String, String>();

        for (SAS_Mapping__mdt sasCDIInstance : [
            SELECT Id, SAS_Field__c, CDI_Field__c FROM SAS_Mapping__mdt 
            WHERE Method_Name__c = :methodName AND SAS_Field__c != NULL AND CDI_Field__c != NULL
        ]) {
            sasToCDIFieldMap.put(sasCDIInstance.SAS_Field__c, sasCDIInstance.CDI_Field__c);
        }
        return !sasToCDIFieldMap.isEmpty() ? sasToCDIFieldMap : null;
    }

    /**
     * @description: Method to get the callout data item fields from the custom metadata which is mapped with the account field 
     * @param methodName - SAS callout method name to get the mapping based on the method.
     * @return String - callout data item fields used to query in the update batch.
     */
    public static String getCDIfieldsToQuery(String methodName) {

        Set<String> cdiFields = new Set<String>{'Id'};

        for (SAS_Mapping__mdt cdiAccInstance : [
            SELECT Id, CDI_Field__c FROM SAS_Mapping__mdt WHERE Method_Name__c = :methodName 
            AND CDI_Field__c != NULL
        ]) {
            cdiFields.add(cdiAccInstance.CDI_Field__c);
        }
        return String.join(new List<String>(cdiFields), ',');
    }
}