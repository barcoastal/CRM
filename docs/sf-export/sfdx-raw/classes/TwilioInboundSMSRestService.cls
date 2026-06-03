/**
 * @Description: This ApexRestService is used for processing inbound SMS and create a SMS record. This service will 
 * be used by Twilio Twil or Studio to send incoming SMS messages. 
 */
@RestResource(urlMapping='/twilio/inbound/sms/*')
global with sharing class TwilioInboundSMSRestService {
    
    @HttpPost
    global static String doPost(){

        try{
        RestRequest request = RestContext.request; 
        RestResponse response = RestContext.response; 
 
        TwilioSMSWrapper sms = (TwilioSMSWrapper) JSON.deserialize(request.requestBody.toString().replace('\n',''), TwilioSMSWrapper.class);
        
        SMSObjectUtility.createInboundSMS(sms);
                        
        }catch(Exception e){
            
            ApplicationLogger.logException(e, null);
        }
        return '';
    }
}