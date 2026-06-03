/**
 * @Description: Batch class to make SAS Bulk API callout to request bulk customer information.
 * Based on the callout request and response, it also creates the Callout Data record and Callout Data Item records.
 * Finally it invoke the BatchSASUpdateAccountInfo class to update the customer information in the Account.
 */
public without sharing class BatchSASGetCustomerRecords implements Database.Batchable<GetCustomerRecordsWrapper>, Database.AllowsCallouts, Database.Stateful {

    public Datetime startDateTime;
    public Datetime endDateTime;
    public Id calloutDataId;

    //Constructor to assign the time frames from the batch call
    public BatchSASGetCustomerRecords(Datetime startDate, Datetime endDate) {
        this.startDateTime = startDate;
        this.endDateTime = endDate;
    }

    //Empty Constructor to assign the time frames to retrieve records for last 24 hourse
    public BatchSASGetCustomerRecords() {
        this.startDateTime = System.now().addHours(-24);
        this.endDateTime = System.now();
    }

    //Start method to create the callout data record based on the SAS getCustomerRecords response.
    public Iterable<GetCustomerRecordsWrapper> start(Database.BatchableContext BC){

        List<GetCustomerRecordsWrapper> getCustomerWrap;
        ProcessorWrapper.API_Response apiResponse = ProcessorAPI.getCustomerRecords('SAS', startDateTime, endDateTime);

        if (apiResponse != null) {

            Callout_Data__c calloutData = new Callout_Data__c();
            calloutData.Method_Name__c = 'GetCustomerRecords';
            calloutData.DateStart__c = startDateTime;
            calloutData.DateEnd__c = endDateTime;
            calloutData.Message__c = apiResponse.message;
            calloutData.IsSuccess__c = apiResponse.isSuccess;
            calloutData.Records_Count__c = apiResponse.recordsCount;
            calloutData.Status__c = apiResponse.status;
            calloutData.Status_Code__c = apiResponse.statusCode;

            Database.SaveResult srData = Database.insert(calloutData, false);
            if (srData.isSuccess()) {           
                this.calloutDataId = srData.getId();
            } else {
                for (Database.Error err : srData.getErrors()) {
                    ApplicationLogger.logDMLException(
                        'Callout Data fields that affected this error : ' + String.join(err.getFields(), ', '), 
                        srData.getId(), err.getStatuscode() + ': ' + err.getMessage()
                    );
                }
            }

            if (apiResponse.isSuccess && apiResponse.processData != null && apiResponse.processData != '' && apiResponse.processData != '[]') {
                ApplicationLogger.logDebugInfo('Successfully retrieved data from GetCustomerRecords callout', this.calloutDataId);  
                getCustomerWrap = (List<GetCustomerRecordsWrapper>)JSON.deserialize(apiResponse.processData, List<GetCustomerRecordsWrapper>.class);
            } else {
                ApplicationLogger.logDebugInfo(String.isNotBlank(apiResponse.message) ? apiResponse.message : 'No Data found.', this.calloutDataId);  
            }
        }
        return getCustomerWrap != null ? getCustomerWrap : new List<GetCustomerRecordsWrapper>();
    }
    
    //Execute method to create Callout Data Item records based on the data retrieved from SAS getCustomerRecords response.
    public void execute(Database.BatchableContext BC, List<GetCustomerRecordsWrapper> scope){

        List<Callout_Data_Item__c> calloutDataItemList = new List<Callout_Data_Item__c>();
        Map<String, String> sasToCDIFieldMap = SASUtility.formSASwithCDIFieldMapping('GetCustomerRecords');
       
        for(GetCustomerRecordsWrapper custWrap : scope){
            Map<String, Object> custWrapMap = (Map<String, Object>)JSON.deserializeUntyped(JSON.serialize(custWrap));
            Map<String, String> cDIMap = new Map<String, String>{'Callout_Data__c' => String.valueOf(calloutDataId)};
            for (String sasField : sasToCDIFieldMap.keySet()) {
                if (custWrapMap.get(sasField) != null) {
                    cDIMap.put(sasToCDIFieldMap.get(sasField), String.valueOf(custWrapMap.get(sasField)));
                }
            }
            calloutDataItemList.add((Callout_Data_Item__c)ApexUtil.typeConversion('Callout_Data_Item__c', cDIMap));
        }
        if (!calloutDataItemList.isEmpty()) {
            for (Database.SaveResult srData : Database.insert(calloutDataItemList, false)) {
                if (!srData.isSuccess()) {           
                    for (Database.Error err : srData.getErrors()) {
                        ApplicationLogger.logDMLException(
                            'Callout Data Item fields that affected this error : ' + String.join(err.getFields(), ', '), 
                            srData.getId(), err.getStatuscode() + ': ' + err.getMessage()
                        );
                    }
                }
            }
        }
    }
    
    //Finish method to invoke concurrent Batch call to update the customer information in Account records.
    public void finish(Database.BatchableContext BC){  
        if (String.isNotBlank(calloutDataId)) {
            Database.executeBatch(new BatchSASUpdateAccountInfo(calloutDataId));
        }
    }
    
    /**
     * @Description: Wrapper class to store the Bulk API response from the GetCustomerRecords SAS callout.
     */
    public class GetCustomerRecordsWrapper {
        public String id;
        public String clients_id;
        public String remoteid;
        public String display;
        public String clients_display;
        public String customerstatus_enums_id;
        public String customerstatus;
        public Boolean isportalactive;
        public String firstname;
        public String lastname;
        public String company;
        public String email;
        public String phone1;
        public String phone2;
        public String phone3;
        public Decimal balance;
        public String address1;
        public String address2;
        public String address3;
        public String address4;
        public String city;        
        public String country;
        public String state;
        public String postalcode;
        public DateTime created;
        public String createdby;
        public DateTime modified;
        public String modifiedby;
        public String ssntid;
        public String password;
        public String salt;
        public Integer totalfailed;
        public Integer rownumber;
        public Integer cnt;
    }
}