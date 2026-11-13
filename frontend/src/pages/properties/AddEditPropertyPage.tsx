import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createProperty,
  getProperty as fetchPropertyById,
  updateProperty,
} from '../../api/properties';
import { getNeighborhoods } from '../../api/market';
import type { PropertyCondition, PropertyType } from '../../types';
import { PageHero } from '../../components/ui/kit-core';
import { TableSkeleton } from '../../components/ui/kit-blocks';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Upload,
  X,
  MapPin,
  Home,
  DollarSign,
  FileText,
  Image as ImageIcon,
  Save,
  Send
} from 'lucide-react';

interface PropertyFormData {
  // Basic Info
  title: string;
  description: string;
  type: 'apartment' | 'villa' | 'condominium' | 'commercial' | '';
  
  // Location
  city: string;
  neighborhood: string;
  address: string;
  latitude?: number;
  longitude?: number;
  
  // Property Details
  area: number;
  bedrooms?: number;
  bathrooms?: number;
  floors?: number;
  condition: 'new' | 'excellent' | 'good' | 'fair' | 'needs_renovation' | '';
  yearBuilt?: number;
  
  // Pricing
  price: number;
  priceType: 'sale' | 'rent';
  rentPeriod?: 'monthly' | 'yearly';
  
  // Features
  features: string[];
  
  // Images
  images: File[];
}

const initialFormData: PropertyFormData = {
  title: '',
  description: '',
  type: '',
  city: 'Addis Ababa',
  neighborhood: '',
  address: '',
  area: 0,
  condition: '',
  price: 0,
  priceType: 'sale',
  features: [],
  images: []
};

const TYPE_TO_API: Record<string, PropertyType> = {
  apartment: 'APARTMENT',
  villa: 'VILLA',
  condominium: 'CONDOMINIUM',
  commercial: 'OFFICE',
};

const API_TO_TYPE: Record<string, PropertyFormData['type']> = {
  APARTMENT: 'apartment',
  VILLA: 'villa',
  CONDOMINIUM: 'condominium',
  OFFICE: 'commercial',
  RETAIL: 'commercial',
  WAREHOUSE: 'commercial',
  LAND: 'villa',
};

const CONDITION_TO_API: Record<string, PropertyCondition> = {
  new: 'NEW',
  excellent: 'EXCELLENT',
  good: 'GOOD',
  fair: 'FAIR',
  needs_renovation: 'NEEDS_RENOVATION',
};

const API_TO_CONDITION: Record<string, PropertyFormData['condition']> = {
  NEW: 'new',
  EXCELLENT: 'excellent',
  GOOD: 'good',
  FAIR: 'fair',
  NEEDS_RENOVATION: 'needs_renovation',
};

/** Load an existing listing into the form shape. */
async function getProperty(id: string): Promise<PropertyFormData> {
  const property = await fetchPropertyById(id);
  const asking = Number(property.askingPrice) || 0;
  const rent = Number(property.rentalPrice) || 0;
  return {
    title: property.title,
    description: property.description ?? '',
    type: API_TO_TYPE[property.propertyType] ?? 'apartment',
    city: property.neighborhood?.city ?? 'Addis Ababa',
    neighborhood: property.neighborhood?.name ?? '',
    address: property.address ?? '',
    latitude: property.latitude ?? undefined,
    longitude: property.longitude ?? undefined,
    area: Number(property.sizeSqm) || 0,
    bedrooms: property.bedrooms ?? 0,
    bathrooms: property.bathrooms ?? 0,
    condition: API_TO_CONDITION[property.condition] ?? 'good',
    price: asking || rent,
    priceType: asking > 0 ? 'sale' : 'rent',
    features: [],
    images: [],
  };
}

/**
 * Persist the form. The backend needs a neighbourhood UUID, enums and a size
 * in square metres, so the free-text neighbourhood is resolved against the
 * live neighbourhood list first.
 */
async function saveProperty(
  form: PropertyFormData,
  options: { id?: string; isDraft?: boolean } = {},
): Promise<{ id: string; success: boolean }> {
  const neighborhoods = await getNeighborhoods();
  const wanted = form.neighborhood.trim().toLowerCase();
  const match =
    neighborhoods.find((n) => n.name.toLowerCase() === wanted) ??
    neighborhoods.find((n) => n.name.toLowerCase().includes(wanted) && wanted.length > 2);

  if (!match) {
    throw new Error(
      'Choose a neighbourhood from the list — listings are limited to Addis Ababa.',
    );
  }

  const payload = {
    title: form.title,
    description: form.description || undefined,
    propertyType: TYPE_TO_API[form.type] ?? 'APARTMENT',
    condition: CONDITION_TO_API[form.condition] ?? 'GOOD',
    neighborhoodId: match.id,
    address: form.address,
    latitude: form.latitude,
    longitude: form.longitude,
    sizeSqm: Number(form.area),
    bedrooms: Number(form.bedrooms ?? 0),
    bathrooms: Number(form.bathrooms ?? 0),
    askingPrice: Number(form.price),
    rentalPrice: form.priceType === 'rent' ? Number(form.price) : undefined,
    listingDate: new Date().toISOString().slice(0, 10),
  };

  if (options.id) {
    const updated = await updateProperty(options.id, payload);
    return { id: updated.id, success: true };
  }

  const created = await createProperty(payload);
  return { id: created.id, success: true };
}

const PROPERTY_FEATURES = [
  'Balcony', 'Modern kitchen', 'Air conditioning', 'Parking space',
  'Security system', 'Elevator access', 'Gym access', 'Swimming pool',
  'Garden', 'Terrace', 'Furnished', 'Pet friendly', 'Storage room',
  'Laundry room', 'Internet ready', 'Solar power', 'Generator backup'
];

export default function AddEditPropertyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<PropertyFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const queryClient = useQueryClient();

  const { data: loadedProperty, isLoading } = useQuery({
    queryKey: ['property', id],
    queryFn: () => getProperty(id!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (loadedProperty) {
      setFormData(loadedProperty);
    }
  }, [loadedProperty]);

  const savePropertyMutation = useMutation({
    mutationFn: ({ data, isDraft }: { data: PropertyFormData; isDraft: boolean }) =>
      saveProperty(data, { id: isEdit ? id : undefined, isDraft }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      if (result.success) {
        navigate('/app/my-properties');
      }
    },
  });

  const steps = [
    { number: 1, title: 'Basic Information', icon: Home },
    { number: 2, title: 'Location', icon: MapPin },
    { number: 3, title: 'Property Details', icon: FileText },
    { number: 4, title: 'Pricing', icon: DollarSign },
    { number: 5, title: 'Features & Images', icon: ImageIcon }
  ];

  const updateFormData = (field: keyof PropertyFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1:
        if (!formData.title) newErrors.title = 'Title is required';
        if (!formData.description) newErrors.description = 'Description is required';
        if (!formData.type) newErrors.type = 'Property type is required';
        break;
      case 2:
        if (!formData.neighborhood) newErrors.neighborhood = 'Neighborhood is required';
        if (!formData.address) newErrors.address = 'Address is required';
        break;
      case 3:
        if (!formData.area || formData.area <= 0) newErrors.area = 'Valid area is required';
        if (!formData.condition) newErrors.condition = 'Condition is required';
        break;
      case 4:
        if (!formData.price || formData.price <= 0) newErrors.price = 'Valid price is required';
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 5));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSaveDraft = () => {
    savePropertyMutation.mutate({ data: formData, isDraft: true });
  };

  const handleSubmit = () => {
    if (validateStep(currentStep)) {
      savePropertyMutation.mutate({ data: formData, isDraft: false });
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setFormData(prev => ({
      ...prev,
      images: [...prev.images, ...files].slice(0, 10) // Max 10 images
    }));
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const toggleFeature = (feature: string) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter(f => f !== feature)
        : [...prev.features, feature]
    }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <TableSkeleton rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Hero */}
      <PageHero
        icon={Home}
        title={isEdit ? 'Edit Property' : 'Add New Property'}
        description={
          isEdit
            ? 'Update your listing details and keep your portfolio accurate.'
            : 'Create a new listing step by step — it goes live after approval.'
        }
        accent="emerald"
        actions={
          <button
            onClick={() => navigate('/app/my-properties')}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-slate-900/50 backdrop-blur-xl px-4 py-2 text-sm font-semibold text-gray-300 transition-all hover:border-slate-400 hover:bg-white/5"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to My Properties
          </button>
        }
      />

      {/* Progress Steps */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div className={`flex items-center gap-3 ${
                step.number < currentStep ? 'text-green-400' :
                step.number === currentStep ? 'text-white' : 'text-gray-400'
              }`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                  step.number < currentStep ? 'bg-green-500 border-green-500 text-white' :
                  step.number === currentStep ? 'bg-blue-500 border-blue-500 text-white' :
                  'border-white/20 bg-slate-800/50 text-gray-400'
                }`}>
                  {step.number < currentStep ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <step.icon className="w-5 h-5" />
                  )}
                </div>
                <div className="hidden md:block">
                  <div className="font-medium text-sm">{step.title}</div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-16 lg:w-20 h-0.5 mx-4 transition-all ${
                  step.number < currentStep ? 'bg-green-500' : 'bg-white/10'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8">
        {currentStep === 1 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-6">Basic Information</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Property Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => updateFormData('title', e.target.value)}
                className={`w-full px-4 py-3 bg-slate-800/50 text-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                  errors.title ? 'border-red-500' : 'border-white/20'
                }`}
                placeholder="e.g., Modern 3BR Apartment in Bole"
              />
              {errors.title && <p className="text-red-400 text-sm mt-1">{errors.title}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Property Type *</label>
              <select
                value={formData.type}
                onChange={(e) => updateFormData('type', e.target.value)}
                className={`w-full px-4 py-3 bg-slate-800/50 text-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                  errors.type ? 'border-red-500' : 'border-white/20'
                }`}
              >
                <option value="" className="bg-slate-800 text-white">Select property type</option>
                <option value="apartment" className="bg-slate-800 text-white">Apartment</option>
                <option value="villa" className="bg-slate-800 text-white">Villa</option>
                <option value="condominium" className="bg-slate-800 text-white">Condominium</option>
                <option value="commercial" className="bg-slate-800 text-white">Commercial</option>
              </select>
              {errors.type && <p className="text-red-400 text-sm mt-1">{errors.type}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Description *</label>
              <textarea
                value={formData.description}
                onChange={(e) => updateFormData('description', e.target.value)}
                rows={4}
                className={`w-full px-4 py-3 bg-slate-800/50 text-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                  errors.description ? 'border-red-500' : 'border-white/20'
                }`}
                placeholder="Describe your property, its features, and what makes it special..."
              />
              {errors.description && <p className="text-red-400 text-sm mt-1">{errors.description}</p>}
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-6">Location</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => updateFormData('city', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 text-white border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Neighborhood *</label>
                <select
                  value={formData.neighborhood}
                  onChange={(e) => updateFormData('neighborhood', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.neighborhood ? 'border-red-500' : 'border-white/20'
                  }`}
                >
                  <option value="" className="bg-slate-800 text-white">Select neighborhood</option>
                  <option value="Bole">Bole</option>
                  <option value="Kazanchis">Kazanchis</option>
                  <option value="CMC">CMC</option>
                  <option value="Megenagna">Megenagna</option>
                  <option value="Lebu">Lebu</option>
                  <option value="Gerji">Gerji</option>
                </select>
                {errors.neighborhood && <p className="text-red-400 text-sm mt-1">{errors.neighborhood}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Full Address *</label>
              <textarea
                value={formData.address}
                onChange={(e) => updateFormData('address', e.target.value)}
                rows={3}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.address ? 'border-red-500' : 'border-white/20'
                }`}
                placeholder="Enter the complete address of the property"
              />
              {errors.address && <p className="text-red-400 text-sm mt-1">{errors.address}</p>}
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-6">Property Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Area (sqm) *</label>
                <input
                  type="number"
                  value={formData.area || ''}
                  onChange={(e) => updateFormData('area', parseInt(e.target.value) || 0)}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.area ? 'border-red-500' : 'border-white/20'
                  }`}
                  placeholder="150"
                />
                {errors.area && <p className="text-red-400 text-sm mt-1">{errors.area}</p>}
              </div>

              {formData.type !== 'commercial' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Bedrooms</label>
                    <input
                      type="number"
                      value={formData.bedrooms || ''}
                      onChange={(e) => updateFormData('bedrooms', parseInt(e.target.value) || undefined)}
                      className="w-full px-4 py-3 bg-slate-800/50 text-white border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="3"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Bathrooms</label>
                    <input
                      type="number"
                      value={formData.bathrooms || ''}
                      onChange={(e) => updateFormData('bathrooms', parseInt(e.target.value) || undefined)}
                      className="w-full px-4 py-3 bg-slate-800/50 text-white border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="2"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Condition *</label>
                <select
                  value={formData.condition}
                  onChange={(e) => updateFormData('condition', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.condition ? 'border-red-500' : 'border-white/20'
                  }`}
                >
                  <option value="" className="bg-slate-800 text-white">Select condition</option>
                  <option value="new">New</option>
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="needs_renovation">Needs Renovation</option>
                </select>
                {errors.condition && <p className="text-red-400 text-sm mt-1">{errors.condition}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Year Built</label>
                <input
                  type="number"
                  value={formData.yearBuilt || ''}
                  onChange={(e) => updateFormData('yearBuilt', parseInt(e.target.value) || undefined)}
                  className="w-full px-4 py-3 bg-slate-800/50 text-white border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="2022"
                  min="1900"
                  max={new Date().getFullYear()}
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-6">Pricing</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Listing Type</label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="sale"
                    checked={formData.priceType === 'sale'}
                    onChange={(e) => updateFormData('priceType', e.target.value)}
                    className="w-4 h-4 text-blue-500 bg-slate-800/50 border-white/20 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-white">For Sale</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="rent"
                    checked={formData.priceType === 'rent'}
                    onChange={(e) => updateFormData('priceType', e.target.value)}
                    className="w-4 h-4 text-blue-500 bg-slate-800/50 border-white/20 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-white">For Rent</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Price (ETB) *
                </label>
                <input
                  type="number"
                  value={formData.price || ''}
                  onChange={(e) => updateFormData('price', parseInt(e.target.value) || 0)}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.price ? 'border-red-500' : 'border-white/20'
                  }`}
                  placeholder="3500000"
                />
                {errors.price && <p className="text-red-400 text-sm mt-1">{errors.price}</p>}
              </div>

              {formData.priceType === 'rent' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Rent Period</label>
                  <select
                    value={formData.rentPeriod || 'monthly'}
                    onChange={(e) => updateFormData('rentPeriod', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800/50 text-white border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              )}
            </div>

            {formData.price > 0 && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm text-gray-400">
                  Price per sqm: <strong>ETB {Math.round(formData.price / (formData.area || 1)).toLocaleString()}</strong>
                </p>
              </div>
            )}
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-6">Features & Images</h2>
            
            {/* Features */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-4">Property Features</label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {PROPERTY_FEATURES.map((feature) => (
                  <label key={feature} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.features.includes(feature)}
                      onChange={() => toggleFeature(feature)}
                      className="w-4 h-4 text-blue-500 bg-slate-800/50 border-white/20 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-300">{feature}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Images */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-4">Property Images</label>
              
              <div className="border-2 border-dashed border-blue-500/30 bg-slate-800/30 rounded-lg p-6">
                <div className="text-center">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <label className="cursor-pointer">
                    <span className="text-gray-300">Click to upload images</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                  <p className="text-sm text-gray-400 mt-2">
                    Upload up to 10 images. Supported formats: JPG, PNG, WebP
                  </p>
                </div>
              </div>

              {formData.images.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  {formData.images.map((image, index) => (
                    <div key={index} className="relative">
                      <img
                        src={URL.createObjectURL(image)}
                        alt={`Property ${index + 1}`}
                        className="w-full aspect-square object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <div className="flex gap-3">
          {currentStep > 1 && (
            <button
              onClick={handlePrevious}
              className="flex items-center gap-2 px-6 py-3 bg-slate-800/50 text-white border border-white/20 rounded-lg hover:bg-white/10 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </button>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={savePropertyMutation.isPending}
            className="flex items-center gap-2 px-6 py-3 bg-slate-800/50 text-gray-300 border border-white/20 rounded-lg hover:bg-white/10 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            Save Draft
          </button>

          {currentStep < 5 ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={savePropertyMutation.isPending}
              className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savePropertyMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit for Review
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

