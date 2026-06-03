trigger docusignEnvelopeStatusTrigger on dfsle__EnvelopeStatus__c (after insert,after update) {
    new DocusignEnvelopeStatusHandler().run();
}