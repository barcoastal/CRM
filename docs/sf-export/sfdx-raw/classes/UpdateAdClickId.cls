@RestResource(urlMapping='/UpdateAdClickId/*')
global without sharing class UpdateAdClickId {
    
    @HttpGet
    global static UpdateAdClickIdResponse doGet(){
        
        RestRequest req = RestContext.request;
        RestResponse res = RestContext.response;  
        
        try{
            String fromPhone = req.params.get('fromPhoneNumber');
            String toPhone = req.params.get('toPhoneNumber');
            String adClickId = req.params.get('adClickId');
            
            UpdateAdClickIdResponse updateResponse = new UpdateAdClickIdResponse();
            
            if (String.isBlank(fromPhone) || String.isBlank(toPhone) || String.isBlank(adClickId)) {
                throw new updateAdClickIdException('Required fields are missing , params received : '+ req.params.toString());
            }
            String formattedPhoneNumber = formatPhoneNumber(toPhone);
            String leadSource = InboundPhoneLeadSourceMdt.getInboundPhoneLeadSource(formattedPhoneNumber);
            
            if(String.isBlank(leadSource)) {
               res.statusCode = 200;
               updateResponse.isSuccess = true;
               updateResponse.message = 'No Inbound Lead Source mapping found for the provided toPhoneNumber. ';
               ApplicationLogger.logException('UpdateAdClickId ', String.valueOf(req) ,formattedPhoneNumber, 'No Inbound Lead Source mapping found for the provided toPhoneNumber : ' + toPhone + ' , fromPhoneNumber :' + fromPhone + ' , LeadSource : ' + leadSource);
               ApplicationLogger.insertStoredLogs();
               return updateResponse;
            }
            List<Lead> matchingLead = LeadData.getLeadByPhoneAndLeadSource(fromPhone,leadSource);
                
            if(!matchingLead.IsEmpty()) {
                Lead LeadInstance = New Lead();
                LeadInstance.Id = matchingLead[0].Id;
                LeadInstance.Ad_Click_Id__c = adClickId;
                update LeadInstance;
                updateResponse.isSuccess = true;
                updateResponse.message = 'Lead updated successfully';
                ApplicationLogger.logInfoLog(String.valueOf(req),'adClickId updated successfully on Lead' ,String.valueOf(leadInstance.Id));
            } else {
               res.statusCode = 200;
               updateResponse.isSuccess = true;
               updateResponse.message = 'No Matching Lead found';
               ApplicationLogger.logException('UpdateAdClickId ', String.valueOf(req) , formattedPhoneNumber, 'No Matching Lead found for fromPhone : ' + fromPhone + ', toPhone : '   + toPhone + ', LeadSource : ' + leadSource );
               createAsyncOpRecord(fromPhone,leadSource,adClickId);
               ApplicationLogger.insertStoredLogs();
            }
            return updateResponse;
            
        } catch(Exception ex) {
           UpdateAdClickIdResponse updateResponse = new UpdateAdClickIdResponse();
           res.statusCode = 500; 
           updateResponse.isSuccess = false;
           updateResponse.message = ex.getMessage();
           ApplicationLogger.logException('UpdateAdClickId',String.valueOf(req) ,'', ex.getMessage());
           ApplicationLogger.insertStoredLogs();
           return updateResponse;
        }
    }
    
    private static String formatPhoneNumber(String rawPhoneNumber) {
        
        String digitsOnly = rawPhoneNumber.replaceAll('[^0-9]', ''); 
        if (digitsOnly.startsWith('1') && digitsOnly.length() == 11) {
            return digitsOnly.substring(1);
        }
        return digitsOnly;
    }
    
    global class UpdateAdClickIdResponse {
        global Boolean isSuccess;
        global  String message;
    }
    
    public class updateAdClickIdException extends Exception {}

    private static void createAsyncOpRecord(String fromPhone, String leadSource,String adClickId){
        Map<String,Object> params = new Map<String,Object>();
        params.put('leadSource',leadSource);
        String leadDetails = JSON.serialize(params);
        AsyncOperationUtil.createUpdateAdClickIdAsyncOperation(AsyncOperationUtil.ASYNC_TYPE_ENUM.BATCH,AsyncOperationUtil.OPERATION_ADCLICK_ID_UPDATE,leadDetails,fromPhone,adClickId,leadSource);
        AsyncOperationUtil.dmlCachedAsyncOperations();
    }
}