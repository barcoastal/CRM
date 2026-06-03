/**
 * @Description: Batch class to make SAS Bulk API callout to get the status of a payment, 
 * based on its PrimaryKey that was returned in the ProcessTrustPayment API method or an invoice number.
 * Based on the callout request and response, it also creates the Callout Data record and Callout Data Item records.
 * Finally it invoke the BatchSASUpdatePaymentStatus class to update the Status in the Draft records.
 */
public without sharing class BatchSASGetPaymentStatus implements Database.Batchable<GetPaymentStatusWrapper>, Database.AllowsCallouts, Database.Stateful {

    public Id calloutDataId;

    //Start method to create the callout data record based on the SAS getPaymentStatus response.
    public Iterable<GetPaymentStatusWrapper> start(Database.BatchableContext BC){

        List<GetPaymentStatusWrapper> getPaymentWrap;
        ProcessorWrapper.API_Response apiResponse = ProcessorAPI.getPaymentStatus('SAS');

        if (apiResponse != null) {

            Callout_Data__c calloutData = new Callout_Data__c();
            calloutData.Method_Name__c = 'GetPaymentStatusBulk';
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
                ApplicationLogger.logDebugInfo('Successfully retrieved data from GetPaymentStatus bulk callout', this.calloutDataId);  
                getPaymentWrap = (List<GetPaymentStatusWrapper>)JSON.deserialize(apiResponse.processData, List<GetPaymentStatusWrapper>.class);
            } else {
                ApplicationLogger.logDebugInfo(String.isNotBlank(apiResponse.message) ? apiResponse.message : 'No Data found.', this.calloutDataId);  
            }
        }
        return getPaymentWrap != null ? getPaymentWrap : new List<GetPaymentStatusWrapper>();
    }
    
    //Execute method to create Callout Data Item records based on the data retrieved from SAS getPaymentStatus response.
    public void execute(Database.BatchableContext BC, List<GetPaymentStatusWrapper> scope){

        List<Callout_Data_Item__c> calloutDataItemList = new List<Callout_Data_Item__c>();
        Map<String, String> sasToCDIFieldMap = SASUtility.formSASwithCDIFieldMapping('GetPaymentStatusBulk');
       
        for(GetPaymentStatusWrapper paymentWrap : scope){
            Map<String, Object> paymentWrapMap = (Map<String, Object>)JSON.deserializeUntyped(JSON.serialize(paymentWrap));
            Map<String, String> cDIMap = new Map<String, String>{'Callout_Data__c' => String.valueOf(calloutDataId)};
            for (String sasField : sasToCDIFieldMap.keySet()) {
                if (paymentWrapMap.get(sasField) != null) {
                    cDIMap.put(sasToCDIFieldMap.get(sasField), String.valueOf(paymentWrapMap.get(sasField)));
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
    
    //Finish method to invoke concurrent Batch call to update the payment status in draft records.
    public void finish(Database.BatchableContext BC){
        if (String.isNotBlank(calloutDataId)) {
            Database.executeBatch(new BatchSASUpdatePaymentStatus(calloutDataId));
        }
    }
    
    /**
     * @Description: Wrapper class to store the Bulk API response from the GetPaymentStatus SAS callout.
     */
    public class GetPaymentStatusWrapper {
        public String id;
        public String invoicenumber;
        public String ach_id;
        public String paymentstatus;
        public String field1;
        public String field2;
        public String field3;
        public String field4;
        public String field5;
        public Decimal total;
        public String paymentstatus_enums_id;
        public String paymentmethods_display;
        public String customers_id;
        public String customers_display;
        public String customers_email;
        public String customers_remoteid;
        public String customers_phone1;
        public String customerstatus_enums_id;
        public String clients_id;
        public String clients_email;
        public Decimal balance;
        public Decimal totalnsf;
    }
}