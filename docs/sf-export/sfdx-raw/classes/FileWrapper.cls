public inherited sharing class FileWrapper {
    
    public Id clientSFId;
    public String clientExtProcId;
    public Blob contractDetails;
    public String fileName;
    public String docType;
    public FileWrapper(Account acctRecord, ContentVersion contVersion) {
        this.clientSFId = acctRecord.Id;
        if(acctRecord.External_SAS_Id__c != null){
            this.clientExtProcId = acctRecord.External_SAS_Id__c;
        }else if(acctRecord.External_RAM_Id__c != null) {
            this.clientExtProcId = acctRecord.External_RAM_Id__c;
            this.docType = RAMWrapper.docType;
        }
        this.contractDetails = contVersion.versionData;
        this.fileName = contVersion.Title;
    }
    //Required Parameters List
    public static Map<String, String> requiredNodesMap = new Map<String, String> {
        'clientSFId' => 'Client SF Id',
        'clientExtProcId' => 'Client External Processor Id',
        'contractDetails' => 'Contact Details'
    };
}