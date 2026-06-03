public without sharing class FeeTriggerHandler extends TriggerHandler {
    
    public override void afterInsert() {
        FeeAfterTriggerHelper.calculatePaymentSummaries();
    }

    public override void afterUpdate() {
        FeeAfterTriggerHelper.calculatePaymentSummaries();
    }

    public override void afterDelete() {
        FeeAfterTriggerHelper.calculatePaymentSummaries();
    }
}