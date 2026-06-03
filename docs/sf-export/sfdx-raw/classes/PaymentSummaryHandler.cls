/*----------------------------------------------------------------
    Author: Vinitha R
    Description: A handler class to perform the paymentSummary trigger actions.
    Test Class: 

    History
    <Date>          <Authors Name>          <Brief Description of Change>   
    Mar-23-2025     Vinitha                  Initial Development                
--------------------------------------------------------------------*/
public without sharing class PaymentSummaryHandler extends TriggerHandler {

    public override void afterUpdate() {
        PaymentSummaryTriggerHelper.checkPaymentFee();
        PaymentSummaryTriggerHelper.checkProgramCompletionStage();
    }
}