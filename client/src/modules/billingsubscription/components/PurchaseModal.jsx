import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import { X, CreditCard, Plus, CheckCircle, AlertCircle, Loader } from "lucide-react";
import { Button } from "../../../components";
import { 
  purchaseSubscription, 
  getPaymentMethods, 
  addPaymentMethod,
  getBillingData 
} from "../slice/billingSlice";

const PurchaseModal = ({ isOpen, onClose, plan, onSuccess }) => {
  const dispatch = useDispatch();
  const { paymentMethods, loading, error } = useSelector((state) => state.billing);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [showAddPaymentForm, setShowAddPaymentForm] = useState(false);
  const [paymentFormData, setPaymentFormData] = useState({
    type: "Credit Card",
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    cardholderName: "",
    email: "",
  });
  const [formErrors, setFormErrors] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen && paymentMethods.length === 0) {
      dispatch(getPaymentMethods());
    }
    // Set default payment method if available
    if (paymentMethods.length > 0 && !selectedPaymentMethod) {
      const defaultMethod = paymentMethods.find(m => m.default) || paymentMethods[0];
      setSelectedPaymentMethod(defaultMethod?.id || null);
    }
    // Clear form errors when modal closes
    if (!isOpen) {
      setFormErrors({});
      setShowAddPaymentForm(false);
    }
  }, [isOpen, paymentMethods, dispatch]);
  
  // Update selected payment method when payment methods list changes
  useEffect(() => {
    if (paymentMethods.length > 0) {
      // If no payment method is selected, select default or first one
      if (!selectedPaymentMethod) {
        const defaultMethod = paymentMethods.find(m => m.default) || paymentMethods[0];
        setSelectedPaymentMethod(defaultMethod?.id || null);
      } else {
        // Verify selected payment method still exists in the list
        const methodExists = paymentMethods.some(m => m.id === selectedPaymentMethod);
        if (!methodExists) {
          // If selected method no longer exists, select default or first one
          const defaultMethod = paymentMethods.find(m => m.default) || paymentMethods[0];
          setSelectedPaymentMethod(defaultMethod?.id || null);
        }
      }
    }
  }, [paymentMethods]);

  // Validation functions
  const validateCardNumber = (cardNumber) => {
    const cleaned = cardNumber.replace(/\s/g, '');
    if (!cleaned) return 'Card number is required';
    if (!/^\d+$/.test(cleaned)) return 'Card number must contain only numbers';
    if (cleaned.length < 13 || cleaned.length > 19) return 'Card number must be between 13 and 19 digits';
    return '';
  };

  const validateExpiryDate = (expiryDate) => {
    if (!expiryDate) return 'Expiry date is required';
    const regex = /^(0[1-9]|1[0-2])\/\d{2}$/;
    if (!regex.test(expiryDate)) return 'Expiry date must be in MM/YY format';
    
    const [month, year] = expiryDate.split('/');
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear() % 100;
    const currentMonth = currentDate.getMonth() + 1;
    const expiryYear = parseInt(year, 10);
    const expiryMonth = parseInt(month, 10);
    
    if (expiryYear < currentYear || (expiryYear === currentYear && expiryMonth < currentMonth)) {
      return 'Card has expired';
    }
    return '';
  };

  const validateCVV = (cvv) => {
    if (!cvv) return 'CVV is required';
    if (!/^\d+$/.test(cvv)) return 'CVV must contain only numbers';
    if (cvv.length < 3 || cvv.length > 4) return 'CVV must be 3 or 4 digits';
    return '';
  };

  const validateCardholderName = (name) => {
    if (!name) return 'Cardholder name is required';
    if (name.trim().length < 2) return 'Cardholder name must be at least 2 characters';
    if (!/^[a-zA-Z\s'-]+$/.test(name)) return 'Cardholder name can only contain letters, spaces, hyphens, and apostrophes';
    return '';
  };

  const validateForm = () => {
    const errors = {
      cardNumber: validateCardNumber(paymentFormData.cardNumber),
      expiryDate: validateExpiryDate(paymentFormData.expiryDate),
      cvv: validateCVV(paymentFormData.cvv),
      cardholderName: validateCardholderName(paymentFormData.cardholderName),
    };
    setFormErrors(errors);
    return !Object.values(errors).some(error => error !== '');
  };

  // Check if form is valid (for button state) without setting errors
  const isFormValid = () => {
    const cardNumberValid = !validateCardNumber(paymentFormData.cardNumber);
    const expiryDateValid = !validateExpiryDate(paymentFormData.expiryDate);
    const cvvValid = !validateCVV(paymentFormData.cvv);
    const cardholderNameValid = !validateCardholderName(paymentFormData.cardholderName);
    
    return cardNumberValid && expiryDateValid && cvvValid && cardholderNameValid;
  };

  // Format card number as user types
  const handleCardNumberChange = (e) => {
    let value = e.target.value.replace(/\s/g, '');
    // Only allow digits
    value = value.replace(/\D/g, '');
    // Add spaces every 4 digits
    value = value.match(/.{1,4}/g)?.join(' ') || value;
    // Limit to 19 digits
    if (value.replace(/\s/g, '').length <= 19) {
      setPaymentFormData({ ...paymentFormData, cardNumber: value });
      // Clear error when user starts typing
      if (formErrors.cardNumber) {
        setFormErrors({ ...formErrors, cardNumber: '' });
      }
    }
  };

  // Format expiry date as user types
  const handleExpiryDateChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length >= 2) {
      value = value.slice(0, 2) + '/' + value.slice(2, 4);
    }
    setPaymentFormData({ ...paymentFormData, expiryDate: value });
    // Clear error when user starts typing
    if (formErrors.expiryDate) {
      setFormErrors({ ...formErrors, expiryDate: '' });
    }
  };

  // Handle CVV change (only numbers, max 4 digits)
  const handleCVVChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length <= 4) {
      setPaymentFormData({ ...paymentFormData, cvv: value });
      // Clear error when user starts typing
      if (formErrors.cvv) {
        setFormErrors({ ...formErrors, cvv: '' });
      }
    }
  };

  // Handle cardholder name change
  const handleCardholderNameChange = (e) => {
    const value = e.target.value;
    setPaymentFormData({ ...paymentFormData, cardholderName: value });
    // Clear error when user starts typing
    if (formErrors.cardholderName) {
      setFormErrors({ ...formErrors, cardholderName: '' });
    }
  };

  const handleAddPaymentMethod = async (e) => {
    e.preventDefault();
    
    // Validate form before submitting
    if (!validateForm()) {
      toast.error('Please fix the errors in the form before submitting.');
      return;
    }

    try {
      const result = await dispatch(addPaymentMethod(paymentFormData)).unwrap();
      
      // Get the payment method ID from the response
      // The API returns the payment method object directly in result
      const newPaymentMethodId = result?.id;
      
      // Refresh payment methods list to get updated state
      await dispatch(getPaymentMethods());
      
      // Automatically select the newly added payment method
      // Use a small delay to ensure Redux state is updated
      setTimeout(() => {
        if (newPaymentMethodId) {
          setSelectedPaymentMethod(newPaymentMethodId);
        } else {
          // If no ID in result, select from the updated payment methods list
          // The useEffect will handle this, but we can also do it here as fallback
          const currentMethods = billingState.paymentMethods || paymentMethods;
          if (currentMethods && currentMethods.length > 0) {
            const defaultMethod = currentMethods.find(m => m.default);
            const methodToSelect = defaultMethod || currentMethods[currentMethods.length - 1];
            if (methodToSelect?.id) {
              setSelectedPaymentMethod(methodToSelect.id);
            }
          }
        }
      }, 100);
      
      setShowAddPaymentForm(false);
      setPaymentFormData({
        type: "Credit Card",
        cardNumber: "",
        expiryDate: "",
        cvv: "",
        cardholderName: "",
        email: "",
      });
      setFormErrors({});
      toast.success('Payment method added successfully!');
    } catch (error) {
      console.error('Failed to add payment method:', error);
      toast.error('Failed to add payment method. Please try again.');
    }
  };

  const handlePurchase = async () => {
    if (!plan) return;

    // For free plan, no payment method needed
    if (plan.name.toLowerCase() === 'free') {
      setIsProcessing(true);
      try {
        await dispatch(purchaseSubscription({ 
          planId: plan.id, 
          paymentMethodId: null 
        })).unwrap();
        // Refresh billing data to get updated subscription
        await dispatch(getBillingData());
        toast.success('Subscription updated successfully! You now have access to Free plan features.');
        onSuccess && onSuccess();
        onClose();
      } catch (error) {
        console.error('Failed to purchase subscription:', error);
        toast.error(error?.message || 'Failed to purchase subscription. Please try again.');
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // For paid plans, require payment method
    if (!selectedPaymentMethod && paymentMethods.length === 0) {
      toast.warning('Please add a payment method before purchasing a paid plan.');
      setShowAddPaymentForm(true);
      return;
    }

    if (!selectedPaymentMethod) {
      toast.warning('Please select a payment method.');
      return;
    }

    setIsProcessing(true);
    try {
      await dispatch(purchaseSubscription({ 
        planId: plan.id, 
        paymentMethodId: selectedPaymentMethod 
      })).unwrap();
      // Refresh billing data to get updated subscription with new features
      await dispatch(getBillingData());
      toast.success(`Congratulations! You've successfully upgraded to the ${plan.name} plan. You now have access to all premium features including unlimited projects!`);
      onSuccess && onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to purchase subscription:', error);
      toast.error(error?.message || 'Failed to purchase subscription. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" style={{ zIndex: 9999 }}>
      <div className="relative bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 rounded-2xl w-full max-w-2xl border border-white/10 shadow-2xl flex flex-col" style={{ zIndex: 10000, maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-white/10 flex-shrink-0">
          <h2 className="text-2xl font-bold text-white">Purchase {plan?.name} Plan</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            disabled={isProcessing}
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 px-6 py-4">

        {/* Plan Summary */}
        <div className="bg-white/5 rounded-xl p-6 mb-6 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-white">{plan?.name} Plan</h3>
              <p className="text-gray-300 text-sm">{plan?.period}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-white">{plan?.price}</div>
              <p className="text-gray-400 text-sm">per {plan?.period === 'forever' ? 'forever' : 'month'}</p>
            </div>
          </div>
          <div className="space-y-2">
            {plan?.features?.slice(0, 3).map((feature, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Method Selection */}
        {plan?.name.toLowerCase() !== 'free' && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">Select Payment Method</h3>
            
            {!showAddPaymentForm ? (
              <>
                {paymentMethods.length === 0 ? (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-400" />
                      <p className="text-yellow-200 text-sm">
                        No payment methods found. Please add one to continue.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 mb-4">
                    {paymentMethods.map((method) => (
                      <div
                        key={method.id}
                        onClick={() => setSelectedPaymentMethod(method.id)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedPaymentMethod === method.id
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-white/10 bg-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CreditCard className="w-5 h-5 text-blue-400" />
                            <div>
                              <p className="text-white font-semibold">{method.type}</p>
                              <p className="text-gray-400 text-sm">
                                {method.last4 ? `**** **** **** ${method.last4}` : method.email}
                              </p>
                            </div>
                            {method.default && (
                              <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded">
                                Default
                              </span>
                            )}
                          </div>
                          {selectedPaymentMethod === method.id && (
                            <CheckCircle className="w-5 h-5 text-blue-400" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  onClick={() => setShowAddPaymentForm(true)}
                  className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Payment Method
                </Button>
              </>
            ) : (
              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <h4 className="text-white font-semibold mb-4">Add Payment Method</h4>
                <form onSubmit={handleAddPaymentMethod} className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Card Number</label>
                    <input
                      type="text"
                      value={paymentFormData.cardNumber}
                      onChange={handleCardNumberChange}
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                      className={`w-full px-4 py-2 bg-black/20 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 ${
                        formErrors.cardNumber 
                          ? 'border-red-500 focus:ring-red-500' 
                          : 'border-white/10 focus:ring-blue-500'
                      }`}
                    />
                    {formErrors.cardNumber && (
                      <p className="mt-1 text-sm text-red-400">{formErrors.cardNumber}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Expiry Date</label>
                      <input
                        type="text"
                        value={paymentFormData.expiryDate}
                        onChange={handleExpiryDateChange}
                        placeholder="MM/YY"
                        maxLength={5}
                        className={`w-full px-4 py-2 bg-black/20 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 ${
                          formErrors.expiryDate 
                            ? 'border-red-500 focus:ring-red-500' 
                            : 'border-white/10 focus:ring-blue-500'
                        }`}
                      />
                      {formErrors.expiryDate && (
                        <p className="mt-1 text-sm text-red-400">{formErrors.expiryDate}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">CVV</label>
                      <input
                        type="text"
                        value={paymentFormData.cvv}
                        onChange={handleCVVChange}
                        placeholder="123"
                        maxLength={4}
                        className={`w-full px-4 py-2 bg-black/20 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 ${
                          formErrors.cvv 
                            ? 'border-red-500 focus:ring-red-500' 
                            : 'border-white/10 focus:ring-blue-500'
                        }`}
                      />
                      {formErrors.cvv && (
                        <p className="mt-1 text-sm text-red-400">{formErrors.cvv}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Cardholder Name</label>
                    <input
                      type="text"
                      value={paymentFormData.cardholderName}
                      onChange={handleCardholderNameChange}
                      placeholder="John Doe"
                      className={`w-full px-4 py-2 bg-black/20 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 ${
                        formErrors.cardholderName 
                          ? 'border-red-500 focus:ring-red-500' 
                          : 'border-white/10 focus:ring-blue-500'
                      }`}
                    />
                    {formErrors.cardholderName && (
                      <p className="mt-1 text-sm text-red-400">{formErrors.cardholderName}</p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      onClick={() => {
                        setShowAddPaymentForm(false);
                        setFormErrors({});
                        setPaymentFormData({
                          type: "Credit Card",
                          cardNumber: "",
                          expiryDate: "",
                          cvv: "",
                          cardholderName: "",
                          email: "",
                        });
                      }}
                      className="flex-1 bg-white/10 hover:bg-white/20 text-white"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={loading || !isFormValid()}
                    >
                      {loading ? 'Adding...' : 'Add Payment Method'}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}
        </div>

        {/* Actions - Fixed at bottom */}
        <div className="flex gap-3 p-6 pt-4 border-t border-white/10 flex-shrink-0">
          <Button
            onClick={onClose}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white"
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handlePurchase}
            className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={
              isProcessing || 
              (plan?.name.toLowerCase() !== 'free' && !selectedPaymentMethod)
            }
          >
            {isProcessing ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              `Purchase ${plan?.name} Plan`
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  // Render modal using portal to document body to avoid z-index stacking context issues
  return typeof document !== 'undefined' 
    ? createPortal(modalContent, document.body)
    : null;
};

export default PurchaseModal;

