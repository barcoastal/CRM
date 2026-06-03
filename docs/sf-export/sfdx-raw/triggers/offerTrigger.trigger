trigger offerTrigger on Offer__c (before insert, before update, after update) {
    new OfferHandler().run();
}