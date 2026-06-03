/*----------------------------------------------------------------
    Author: Vinitha 
    Description: This class will perform to upsert the metadata records.
    Test Class: SandboxRefreshScriptTest

    History
    <Date>          <Authors Name>          <Brief Description of Change>       <Code Coverage>
    May-15-2024      Vinitha                      Initial Development             47%  
--------------------------------------------------------------------*/
public  inherited sharing class MetaDataUtility implements Metadata.DeployCallback{
    
    //This method will support do DML for custom metadata records only.
    /**
     * @description: Method to query the custom metadata record based on customMetadataList.
     * @param customMetadataList - Salesforce metadata records
     * @return String - returns the jobId string.
     */
    public static String upsertMetadata(List<sObject> customMetadataList ) {
    
        //Create Deployment container for custom Metadata
        Metadata.DeployContainer mdContainer = new Metadata.DeployContainer();
        for(sobject sObMD : customMetadataList) {
            
            String sObjectname = sObMD.getSObjectType().getDescribe().getName();            
            Metadata.CustomMetadata customMetadata =  new Metadata.CustomMetadata();
            String recordName = String.valueOf(sObMD.get('DeveloperName')).replaceAll(' ','_');
            customMetadata.fullName = sObjectname +'.'+recordName;
            customMetadata.label = (String)sObMD.get('MasterLabel');
            schema.SObjectType sobjType = Schema.getGlobalDescribe().get(sObjectname );            
            Map<String, Schema.sObjectField> sObjectFields = sobjType.getDescribe().fields.getMap();
            Set<String> skipFieldSet = new Set<String>{'developername','masterlabel','language','namespaceprefix', 'label','qualifiedapiname', 'id'};
            
            for(String fieldName : sObMD.getPopulatedFieldsAsMap().keySet()) {
                system.debug(skipFieldSet.contains(fieldName.toLowerCase()));
                if(skipFieldSet.contains(fieldName.toLowerCase()) || sObMD.get(fieldName) == null)
                    continue;
                
                Object value = sObMD.get(fieldName);    
                Metadata.CustomMetadataValue customField = new Metadata.CustomMetadataValue();
                customField.field = fieldName;
                customField.value = value;
                customMetadata.values.add(customField);
            }
            mdContainer.addMetadata(customMetadata);
        }    
        MetaDataUtility callback = new MetaDataUtility();
        Id jobId = Metadata.Operations.enqueueDeployment(mdContainer, callback);
        return jobId;
    }
    
    public void handleResult(Metadata.DeployResult result,
                             Metadata.DeployCallbackContext context) {
                             
        if (result.status == Metadata.DeployStatus.Succeeded) {
            ApplicationLogger.logDebugInfo('Successfully upserted the custom metadata', '');
        } else {
            ApplicationLogger.logDebugInfo('Failed to upserted the custom metadata', '');
        }
        
    }
}